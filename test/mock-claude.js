'use strict';
// A strict mock of the artifact runtime (contract 0.2.60): db, sample, downloads, claude.use().
// It enforces the documented limits so contract violations show up as recorded `violations`.
//   mock.violations   : [{kind, detail}]  every contract breach the page committed
//   mock.sampleCalls  : [{label, bytes, input, opts, outcome}]
//   mock.dbLog        : [{op, path, bytes?}]
//   mock.store        : Map path -> {data, version}
//   mock.downloadsLog : [{filename, bytes}]
//   mock.pending      : number of db operations started and not yet settled
// Every rejection that means the page broke the contract (bad path, bad body, quota, size, bad option) is recorded in
// mock.violations before it is thrown, so a probe can trust an empty violations list.
// Knobs: mock.disable = {db:true, sample:true, downloads:true}; mock.sampleHandler(input, opts, call) -> string | {text, truncated} | throws {code,message}
//        mock.dbFail = (op, path) => error|null ; mock.dbLatency ; mock.sampleLatency ; mock.downloadsDecline

const MAX_DOC = 256 * 1024, MAX_DOCS = 5000, MAX_PROMPT = 65536;
const utf8 = (s) => (typeof Buffer !== 'undefined' ? Buffer.byteLength(s, 'utf8') : new TextEncoder().encode(s).length);
const SEG = /^[A-Za-z0-9_\-.~:@+]+$/;
const DL_EXT = new Set('gif png jpg jpeg webp mp4 webm txt json md docx pptx epub csv ttf html svg pdf xlsx zip'.split(' '));

function depthOf(o, d = 1) { if (o && typeof o === 'object') { let m = d; for (const v of Object.values(o)) m = Math.max(m, depthOf(v, d + 1)); return m; } return d; }
function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; }
function mergeDeep(a, b) { const out = Object.assign({}, a); for (const [k, v] of Object.entries(b)) { if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = mergeDeep(out[k], v); else out[k] = v; } return out; }
const err = (code, message, extra) => Object.assign({ code, message }, extra || {});

// A plain object from any realm (the page's jsdom window or Node): not an array, a Date, a Map or a class instance.
const isPlain = (o) => !!o && typeof o === 'object' && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null || (Object.getPrototypeOf(Object.getPrototypeOf(o)) === null && o.constructor && o.constructor.name === 'Object'));

function install(window, opts) {
  opts = opts || {};
  const mock = {
    violations: [], sampleCalls: [], dbLog: [], downloadsLog: [], store: new Map(),
    disable: {}, dbFail: null, dbLatency: 2, sampleLatency: 3, downloadsDecline: false, sampleHandler: null,
    inflight: new Map(), pending: 0, calls: { db: 0, sample: 0 },
  };
  const violate = (kind, detail) => { mock.violations.push({ kind, detail }); };
  // A contract rejection: record it, then hand back the error to throw.
  const reject = (kind, code, message) => { violate(kind, message); return err(code, message); };
  const badPath = (message) => { violate('bad-path', message); return new TypeError(message); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const win = window;

  // ---------- db ----------
  function checkPath(path, kind) {
    if (typeof path !== 'string' || !path) throw badPath('db: path must be a non-empty string');
    const segs = path.split('/');
    if (segs.length > 16) throw badPath('db: more than 16 segments: ' + path);
    if (utf8(path) > 1000) throw badPath('db: path over 1000 bytes');
    for (const s of segs) { if (!s || s === '.' || s === '..' || !SEG.test(s) || utf8(s) > 200) throw badPath('db: bad segment "' + s + '" in ' + path); }
    if (kind === 'doc' && segs.length % 2 !== 0) throw badPath('db: document path needs an even number of segments: ' + path);
    if (kind === 'col' && segs.length % 2 !== 1) throw badPath('db: collection path needs an odd number of segments: ' + path);
  }
  const snapOf = (path) => { const e = mock.store.get(path); const data = e ? deepFreeze(JSON.parse(JSON.stringify(e.data))) : undefined; return { id: path.split('/').pop(), exists: !!e, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } }; };
  async function op(name, path, fn, bytes) {
    mock.calls.db++; mock.pending++;
    try {
      if (mock.disable.db) throw err('not_granted', 'db not granted');
      if (mock.dbFail) { const f = mock.dbFail(name, path); if (f) { await wait(mock.dbLatency); throw f; } }
      const write = name === 'set' || name === 'update' || name === 'delete';
      if (write) {
        const n = mock.inflight.get(path) || 0; if (n > 0) violate('overlapping-writes', name + ' ' + path + ' while another write to the same doc is in flight');
        mock.inflight.set(path, n + 1);
      }
      try { await wait(mock.dbLatency); mock.dbLog.push({ op: name, path, bytes }); return fn(); }
      finally { if (write) mock.inflight.set(path, mock.inflight.get(path) - 1); }
    } finally { mock.pending--; }
  }
  function checkBody(data, path) {
    if (!isPlain(data)) throw reject('bad-body', 'invalid_argument', 'body must be a plain object: ' + path);
    let json; try { json = JSON.stringify(data); } catch (e) { throw reject('bad-body', 'invalid_argument', 'body not serialisable: ' + path + ': ' + e.message); }
    const bytes = utf8(json);
    if (bytes > MAX_DOC) throw reject('doc-too-large', 'invalid_argument', path + ' is ' + bytes + ' bytes (cap ' + MAX_DOC + ')');
    if (depthOf(JSON.parse(json)) > 32) throw reject('doc-too-deep', 'invalid_argument', 'document deeper than 32 levels: ' + path);
    return { parsed: JSON.parse(json), bytes };
  }
  function docRef(path) {
    checkPath(path, 'doc');
    const ref = {
      id: path.split('/').pop(), path,
      get: () => op('get', path, () => snapOf(path)),
      set: (data) => { const b = checkBody(data, path); return op('set', path, () => { if (!mock.store.has(path) && mock.store.size >= MAX_DOCS) throw reject('doc-quota', 'quota_exceeded', 'database holds at most ' + MAX_DOCS + ' documents; refused ' + path); const e = mock.store.get(path); mock.store.set(path, { data: b.parsed, version: (e ? e.version : 0) + 1 }); }, b.bytes); },
      update: (data) => { const b = checkBody(data, path); return op('update', path, () => { const e = mock.store.get(path); if (!e) throw reject('update-missing-doc', 'invalid_argument', 'update requires the document to exist: ' + path); const merged = mergeDeep(e.data, b.parsed); const b2 = utf8(JSON.stringify(merged)); if (b2 > MAX_DOC) throw reject('doc-too-large', 'invalid_argument', path + ' would be ' + b2 + ' bytes after the merge (cap ' + MAX_DOC + ')'); mock.store.set(path, { data: merged, version: e.version + 1 }); }, b.bytes); },
      delete: () => op('delete', path, () => { mock.store.delete(path); }),
      acquire: (o) => op('acquire', path, () => ({ acquired: true, version: 1, holder: o && o.holder })),
      onSnapshot: (next) => { let live = true; Promise.resolve().then(() => live && next(snapOf(path))); return () => { live = false; }; },
      collection: (p) => colRef(path + '/' + p),
    };
    return ref;
  }
  function query(path, st) {
    const q = {
      where: (f, o, v) => { if (st.filters.length >= 10) throw badPath('db: more than 10 filters on ' + path); return query(path, Object.assign({}, st, { filters: st.filters.concat([[f, o, v]]) })); },
      orderBy: (f, d) => { if (st.order) { violate('two-orderBy', path); throw err('invalid_argument', 'only one orderBy per query: ' + path); } return query(path, Object.assign({}, st, { order: [f, d || 'asc'] })); },
      limit: (n) => { if (!(n >= 1 && n <= 1000)) violate('bad-limit', String(n)); return query(path, Object.assign({}, st, { lim: n })); },
      get: () => op('query', path, () => {
        if (st.lim != null && !(st.lim >= 1 && st.lim <= 1000)) throw err('invalid_argument', 'limit out of range');  // already recorded by limit()
        const depth = path.split('/').length + 1;
        let docs = [...mock.store.keys()].filter((k) => k.startsWith(path + '/') && k.split('/').length === depth).map((k) => ({ k, d: mock.store.get(k).data }));
        for (const [f, o, v] of st.filters) docs = docs.filter(({ d }) => { const x = d[f]; switch (o) { case '==': return x === v; case '!=': return x !== v; case '<': return x < v; case '<=': return x <= v; case '>': return x > v; case '>=': return x >= v; case 'in': return v.includes(x); case 'not-in': return !v.includes(x); case 'array-contains': return Array.isArray(x) && x.includes(v); default: return false; } });
        if (st.order) { const [f, dir] = st.order; docs.sort((a, b) => { const x = a.d[f], y = b.d[f]; if (x === undefined && y === undefined) return 0; if (x === undefined) return 1; if (y === undefined) return -1; const c = x < y ? -1 : x > y ? 1 : 0; return dir === 'desc' ? -c : c; }); }
        else docs.sort((a, b) => (a.k < b.k ? -1 : 1));
        if (st.lim != null) docs = docs.slice(0, st.lim);
        const snaps = docs.map(({ k }) => snapOf(k));
        return { docs: snaps, size: snaps.length, empty: snaps.length === 0, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
      }),
      onSnapshot: (next) => { let live = true; q.get().then((s) => live && next(s)); return () => { live = false; }; },
    };
    return q;
  }
  function colRef(path) {
    checkPath(path, 'col');
    const q = query(path, { filters: [], order: null, lim: null });
    return Object.assign(q, { path, doc: (id) => docRef(path + '/' + (id || ('auto' + Math.random().toString(36).slice(2, 8)))), add: async (data) => { const r = docRef(path + '/auto' + Math.random().toString(36).slice(2, 8)); await r.set(data); return r; } });
  }
  const dbNs = Object.freeze({ doc: docRef, collection: colRef });

  // ---------- downloads ----------
  const dlNs = Object.freeze({
    save: async (req) => {
      if (mock.disable.downloads) throw err('not_granted', 'downloads not granted');
      if (!req || typeof req.filename !== 'string' || req.filename.length > 512) throw reject('download-bad-request', 'bad_request', 'bad filename: ' + String(req && req.filename));
      const ext = (req.filename.split('.').pop() || '').toLowerCase();
      if (!req.filename.includes('.') || !DL_EXT.has(ext)) throw reject('download-extension', 'rejected_extension', 'extension not allowed: ' + req.filename);
      const d = req.data; const bytes = typeof d === 'string' ? utf8(d) : (d && (d.byteLength || d.size)) || 0;
      if (!bytes) throw reject('download-bad-request', 'bad_request', 'empty data for ' + req.filename);
      await wait(2); if (mock.downloadsDecline) throw err('declined', 'viewer declined');
      mock.downloadsLog.push({ filename: req.filename, bytes, data: d }); return { status: 'saved' };
    },
  });

  // ---------- sample ----------
  async function sampleImpl(input, options, asJson) {
    mock.calls.sample++;
    const label = (options && options.__label) || '';
    const call = { label, input, opts: options, bytes: 0, outcome: 'pending', t0: Date.now() };
    mock.sampleCalls.push(call);
    const fail = (code, message, text) => { call.outcome = code; throw err(code, message, text != null ? { text } : undefined); };
    if (mock.disable.sample) fail('not_granted', 'sample not granted');
    if (options !== undefined && !isPlain(options)) { violate('sample-options-not-plain', String(options)); fail('invalid_request', 'options must be a plain object'); }
    options = options || {};
    if (options.signal !== undefined && !(options.signal instanceof win.AbortSignal)) { violate('sample-signal-not-AbortSignal', typeof options.signal); fail('invalid_request', 'signal must be an AbortSignal'); }
    if (options.onText !== undefined && typeof options.onText !== 'function') { violate('sample-bad-onText', typeof options.onText); fail('invalid_request', 'onText must be a function'); }
    if (options.modelTier !== undefined && !['default', 'complex', 'quick'].includes(options.modelTier)) { violate('sample-bad-tier', String(options.modelTier)); fail('invalid_request', 'unknown modelTier ' + options.modelTier); }
    if (options.cache !== undefined && !(typeof options.cache === 'boolean' || isPlain(options.cache))) { violate('sample-bad-cache', String(options.cache)); fail('invalid_request', 'bad cache'); }
    if (options.tools && options.cache !== undefined && options.cache !== false) { violate('sample-cache-with-tools', String(options.cache)); fail('invalid_request', 'cache with tools'); }
    const known = new Set(['onText', 'signal', 'tools', 'images', 'modelTier', 'cache']);
    for (const k of Object.keys(options)) if (!known.has(k)) { violate('sample-unknown-option', k); fail('invalid_request', 'unknown option ' + k); }
    let text;
    if (typeof input === 'string') { if (!input.trim()) { violate('sample-empty-input', 'empty prompt'); fail('invalid_request', 'empty input'); } text = input; }
    else if (Array.isArray(input) && input.length && input[0].role === 'user' && input[input.length - 1].role === 'user' && input.every((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content)) text = input.map((m) => m.content).join('');
    else { violate('sample-bad-input', typeof input); fail('invalid_request', 'input must be a string or user-first/user-last turns'); }
    call.bytes = utf8(text);
    if (call.bytes > MAX_PROMPT) { violate('prompt-too-large', call.bytes + ' bytes (cap ' + MAX_PROMPT + ') label=' + (call.label || '?')); fail('prompt_too_large', 'input over 64 KiB'); }
    if (options.signal && options.signal.aborted) fail('cancelled', 'aborted before start');
    await wait(mock.sampleLatency);
    if (options.signal && options.signal.aborted) fail('cancelled', 'aborted');
    let res;
    // The runtime rejects an aborted call at once, so a slow or held handler is raced against the signal.
    const aborted = options.signal ? new Promise((_, rej) => { const on = () => rej(err('cancelled', 'aborted')); if (options.signal.aborted) on(); else options.signal.addEventListener('abort', on, { once: true }); }) : null;
    try { const work = Promise.resolve().then(() => (mock.sampleHandler || defaultHandler)(input, options, call)); res = await (aborted ? Promise.race([work, aborted]) : work); }
    catch (e) { call.outcome = (e && e.code) || 'handler-threw'; throw (e && e.code) ? e : err('upstream_error', String(e && e.message || e)); }
    if (typeof res === 'string') res = { text: res, truncated: false };
    if (!res || !res.text || !String(res.text).trim()) fail('empty_completion', 'no text');
    // stream in a few chunks, honouring abort and the onText guarantees (text = previous + delta, never sync)
    const full = String(res.text); const parts = 4; let sent = '';
    for (let i = 1; i <= parts; i++) {
      const upto = i === parts ? full.length : Math.floor((full.length * i) / parts);
      const delta = full.slice(sent.length, upto);
      if (delta) { sent += delta; if (options.onText) { try { options.onText({ text: sent, delta }); } catch (e) {} } }
      if (i < parts) { await wait(1); if (options.signal && options.signal.aborted) { call.outcome = 'cancelled'; throw err('cancelled', 'aborted', { text: sent }); } }
    }
    if (options.signal && options.signal.aborted) { call.outcome = 'cancelled'; throw err('cancelled', 'aborted', { text: sent }); }
    call.outcome = res.truncated ? 'truncated' : 'ok';
    if (asJson) { try { return JSON.parse(full); } catch (e) { const m = /[\[{][\s\S]*[\]}]/.exec(full); try { return JSON.parse(m[0]); } catch (e2) { throw err('invalid_json', 'no JSON', { text: full }); } } }
    return { text: full, truncated: !!res.truncated, modelTierApplied: options.modelTier || 'default' };
  }
  const sample = (input, options) => sampleImpl(input, options, false);
  sample.json = (input, options) => sampleImpl(input, options, true);
  sample.limits = async () => ({ maxPromptBytes: MAX_PROMPT });
  Object.freeze(sample);

  // Default model: replies in the turn format; other calls get plain text. Override with mock.sampleHandler.
  const words = (n, w) => Array.from({ length: n }, (_, i) => w[i % w.length]).join(' ');
  function defaultHandler(input, options, call) {
    const label = call.label || '';
    const prompt = typeof input === 'string' ? input : input.map((m) => m.content).join('\n');
    if (/Rewrite it to between/.test(prompt)) return words(120, ['The', 'corridor', 'hums', 'with', 'distant', 'voices', 'as', 'you', 'walk', 'on.']);
    if (/You maintain the long-term memory/.test(prompt)) return 'Day 1: the player arrived, met the roommate and learned the house rules. Nothing else of note.';
    if (/Write the roommate's first appearance/.test(prompt)) return words(130, ['Your', 'roommate', 'looks', 'up', 'from', 'a', 'half-unpacked', 'box', 'and', 'gives', 'you', 'a', 'tired,', 'friendly', 'wave.']);
    if (/Invent the people listed in <people>/.test(prompt)) {
      const block = (/<people>([\s\S]*?)<\/people>/.exec(prompt) || [, ''])[1];
      const L = 'abcdefghijklmnopqrstuvwxyz'; let idx = 0;
      const people = [...block.matchAll(/^- (\w+): .*$/gm)].map((m) => {
        const line = m[0]; const key = m[1]; idx++;
        const f = /first name starting with (\w)/.exec(line); const s = /surname starting with (\w)/.exec(line);
        const fields = ((/Fields: ([^.]*)\./.exec(line) || [, ''])[1]).split(',').map((x) => x.trim()).filter(Boolean);
        const o = { key };
        const suf = (n) => L[n % 26] + L[(n * 7 + 3) % 26] + L[(n * 5 + 1) % 26];
        for (const fld of fields) {
          if (fld === 'first') o.first = ((f && f[1]) || 'A') + 'ave' + suf(idx);
          else if (fld === 'last') o.last = ((s && s[1]) || 'B') + 'orrow' + suf(idx + 11);
          else if (fld === 'background') o.background = 'From a quiet harbour town. A scholarship brought {first} here.';
          else o[fld] = fld + ' text for ' + key;
        }
        return o;
      });
      return JSON.stringify({ people });
    }
    mock.turnCounter = (mock.turnCounter || 0) + 1;
    const n = mock.turnCounter;
    return JSON.stringify({
      evaluation: { stat: 'none', outcome: 'none' },
      narrative: words(180, ['You', 'step', 'forward', 'and', 'the', 'room', 'settles', 'around', 'you,', 'quiet', 'and', 'ordinary.']) + ' *Turn ' + n + '.*',
      suggested_actions: ['Look around', 'Say hello', 'Leave'],
      secret_info: '', state_updates: [], time_advance_minutes: 15,
      events: ['Day 1 10:' + String(10 + (n % 50)) + ' Event number ' + n + ' happened in the corridor.'], beats: ['Beat ' + n], facts: [], exposures: [],
    });
  }
  mock.defaultHandler = defaultHandler;

  // ---------- claude.use ----------
  win.claude = Object.freeze({
    use: async (name) => {
      await wait(1);
      if (name === 'db') return mock.disable.db ? null : dbNs;
      if (name === 'sample') return mock.disable.sample ? null : sample;
      if (name === 'downloads') return mock.disable.downloads ? null : dlNs;
      return null;
    },
  });
  // tag calls with their label: the page passes {label} through its own wrapper, which strips it, so recover it from the prompt kind.
  return mock;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { install, MAX_DOC, MAX_DOCS, MAX_PROMPT }; else window.__WL_MOCK = { install, MAX_DOC, MAX_DOCS, MAX_PROMPT };
