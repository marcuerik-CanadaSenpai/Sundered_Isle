// Static server for the real page with the strict mock injected: node server.js [port]
// GET /            -> src/index.html with the mock installed before the page script
// GET /worlds/*.js -> src/worlds/*
// GET /__mock-claude.js -> mock. In the page: window.__wlMock (mock.violations, sampleCalls, store, sampleHandler, ...)
// Query: ?db=0 or ?sample=0 or ?downloads=0 disables that capability (use() resolves null).
const http = require('http'), fs = require('fs'), path = require('path');
const port = +(process.argv[2] || 4173);
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = u.pathname;
  if (p === '/' || p === '/index.html') {
    let html = fs.readFileSync(process.env.WL_HTML || path.join(__dirname, '..', 'windlass', 'index.html'), 'utf8');
    const off = ['db', 'sample', 'downloads'].filter((k) => u.searchParams.get(k) === '0').map((k) => k + ':true').join(',');
    const inject = '<script src="/__mock-claude.js"></script><script>window.__wlMock=window.__WL_MOCK.install(window);window.__wlMock.disable={' + off + '};</script>\n';
    html = html.replace('<script src="worlds/halloway.js">', inject + '<script src="worlds/halloway.js">');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(html);
  }
  if (p === '/__mock-claude.js') { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); return res.end(fs.readFileSync(path.join(__dirname, 'mock-claude.js'))); }
  const m = /^\/worlds\/([\w.-]+\.js)$/.exec(p);
  if (m) {
    // Read before answering, so a world file that does not exist is a 404 rather than an exception that stops the server.
    let body; try { body = fs.readFileSync(path.join(process.env.WL_WORLDS || path.join(__dirname, '..', 'windlass', 'worlds'), m[1])); }
    catch (e) { res.writeHead(e && e.code === 'ENOENT' ? 404 : 500); return res.end(e && e.code === 'ENOENT' ? 'not found' : 'read error'); }
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); return res.end(body);
  }
  res.writeHead(404); res.end('not found');
}).listen(port, '127.0.0.1', () => console.log('windlass harness on http://127.0.0.1:' + port));
