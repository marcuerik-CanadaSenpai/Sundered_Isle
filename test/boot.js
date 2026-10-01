'use strict';
// boot({ htmlPath, worldsDir, mobile, dark, seed, setup }) -> { window, document, mock, $, click, type, settle, sleep, errors, close }
// Loads the real index.html + worlds/*.js into jsdom with the strict mock runtime (mock-claude.js).
const fs = require('fs'), path = require('path');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const { install } = require('./mock-claude');

const DEFAULT_HTML = process.env.WL_HTML || path.join(__dirname, '..', 'windlass', 'index.html');
const DEFAULT_WORLDS = process.env.WL_WORLDS || path.join(__dirname, '..', 'windlass', 'worlds');

class Loader extends ResourceLoader {
  constructor(worldsDir) { super(); this.worldsDir = worldsDir; }
  fetch(url) {
    const m = /\/worlds\/([\w.-]+\.js)$/.exec(url);
    if (m) return Promise.resolve(fs.readFileSync(path.join(this.worldsDir, m[1])));
    return Promise.resolve(Buffer.from('')); // fonts and anything external: blocked/empty, like the CSP would
  }
}

async function boot(o) {
  o = o || {};
  const htmlPath = o.htmlPath || DEFAULT_HTML, worldsDir = o.worldsDir || DEFAULT_WORLDS;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const errors = [], logs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push({ kind: 'jsdomError', message: String(e && (e.detail && e.detail.stack || e.stack || e.message) || e).slice(0, 1500) }));
  vc.on('error', (...a) => errors.push({ kind: 'console.error', message: a.map(String).join(' ').slice(0, 800) }));
  vc.on('warn', (...a) => logs.push('warn: ' + a.map(String).join(' ').slice(0, 300)));
  vc.on('log', (...a) => logs.push(a.map(String).join(' ').slice(0, 300)));
  let mock = null;
  const dom = new JSDOM(html, {
    url: o.url || 'http://localhost/', runScripts: 'dangerously', resources: new Loader(worldsDir), pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      if (!window.matchMedia) window.matchMedia = (q) => ({ matches: !!(o.mobile && /max-width/.test(q)) || (!!o.dark && /dark/.test(q)), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      const D = window.HTMLDialogElement && window.HTMLDialogElement.prototype;
      if (D && !o.noDialogPolyfill) { D.showModal = function () { this.setAttribute('open', ''); }; D.show = D.showModal; D.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); }; }
      if (!window.Element.prototype.scrollIntoView) window.Element.prototype.scrollIntoView = function () {};
      window.scrollTo = () => {};
      window.Element.prototype.scrollTo = window.Element.prototype.scrollTo || function () {};
      if (!window.Blob.prototype.text) window.Blob.prototype.text = function () { return new Promise((res, rej) => { const r = new window.FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(this); }); };
      mock = install(window, o);
      if (o.setup) o.setup(window, mock);
    },
  });
  const { window } = dom; const { document } = window;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const api = {
    window, document, mock, dom, errors, logs, sleep, $,
    click: (sel) => { const el = typeof sel === 'string' ? $(sel) : sel; if (!el) throw new Error('no element ' + sel); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); return el; },
    type: (sel, text) => { const el = $(sel); el.value = text; el.dispatchEvent(new window.Event('input', { bubbles: true })); el.dispatchEvent(new window.Event('change', { bubbles: true })); return el; },
    // wait until the mock runtime is idle (no sample/db calls pending) for `quiet` ms, or `max` ms
    settle: async (quiet = 60, max = 8000) => { const t0 = Date.now(); let last = -1, stable = 0; while (Date.now() - t0 < max) { const n = mock.calls.db + mock.calls.sample + (mock.sampleCalls.filter((c) => c.outcome === 'pending').length * 1000); if (n === last) { stable += 10; if (stable >= quiet) return true; } else { stable = 0; last = n; } await sleep(10); } return false; },

    // idle(): wait until no turn/roommate call is running and the runtime has no pending calls, then let db writes drain.
    idle: async (max = 20000) => { const t0 = Date.now(); const busyNow = () => !(document.querySelector('#stop') || {hidden:true}).hidden || mock.sampleCalls.some((c) => c.outcome === 'pending'); while (Date.now() - t0 < max && busyNow()) await sleep(10); let last = -1, stable = 0; while (Date.now() - t0 < max) { const n = mock.calls.db; if (n === last) { stable += 10; if (stable >= 60 && !busyNow()) return true; } else { stable = 0; last = n; } await sleep(10); } return false; },
    // turn(text, {max, director}): type an action, press Take turn, wait for the whole turn (model calls, fit, fold, save) to finish.
    turn: async (text, o2 = {}) => { const before = mock.sampleCalls.length; $('#action').value = text; if (o2.director != null) $('#director').value = o2.director; api.click('#send'); const t0 = Date.now(); while (Date.now() - t0 < 600 && mock.sampleCalls.length === before) await sleep(10); return api.idle(o2.max || 20000); },
    close: () => window.close(),
  };
  await sleep(30);
  return api;
}
module.exports = { boot };
