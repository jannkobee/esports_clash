import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, resolve, sep } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function serveStatic(res, pathname) {
  const dist = resolve(root, 'dist');
  const requested = resolve(dist, `.${pathname}`);
  if (requested !== dist && !requested.startsWith(dist + sep)) return json(res, 403, { error: 'Forbidden' });
  let file = requested;
  try {
    if (!(await stat(file)).isFile()) file = join(dist, 'index.html');
  } catch { file = join(dist, 'index.html'); }
  try {
    const data = await readFile(file);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' }[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch { json(res, 404, { error: 'Build the site before starting the production server.' }); }
}

export function makeServer() {
  return createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname.startsWith('/api/')) {
        return json(res, 410, { error: 'MOBA room drafts have been removed.' });
      }
      return serveStatic(res, pathname);
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : 'Request failed.' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4174);
  makeServer().listen(port, '0.0.0.0', () => console.log(`Hexatrick static server on port ${port}`));
}
