const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2];
const types = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.glb':'model/gltf-binary', '.woff2':'font/woff2', '.ico':'image/x-icon', '.webmanifest':'application/manifest+json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    if (p.startsWith('/public/media')) { res.writeHead(302, { Location: '/mock-media.svg' }); return res.end(); }
    f = path.join(root, fs.existsSync(path.join(root,'index.html')) ? 'index.html' : 'index.csr.html');
  }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(4200, () => console.log('listo'));
