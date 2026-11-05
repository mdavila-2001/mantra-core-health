// Servidor mínimo con las mismas reglas que src/server.ts: estáticos, 404 para
// un .js inexistente y el index.html para cualquier otra ruta.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
const [root, port] = [process.argv[2], Number(process.argv[3] ?? 4300)];
const tipos = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
http.createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const archivo = join(root, ruta);
  try {
    if ((await stat(archivo)).isFile()) {
      res.writeHead(200, { 'content-type': tipos[extname(archivo)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      return res.end(await readFile(archivo));
    }
  } catch {}
  if (['.js', '.mjs', '.css', '.map'].includes(extname(ruta))) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-cache' });
  res.end(await readFile(join(root, 'index.html')));
}).listen(port, () => console.log('sirviendo', root, 'en', port));
