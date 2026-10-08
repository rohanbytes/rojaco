#!/usr/bin/env node
/**
 * Rojaco dev server — zero dependencies.
 *
 *   npm run dev            # http://localhost:3000
 *   npm run dev -- --port 8080 --open
 *
 * Static file server with live reload: edits to .html/.js/.json trigger a full
 * page reload, edits to .css are hot-swapped without losing scroll position.
 * Everything in DENIED_SEGMENTS (notably `private/`) is never served.
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const ROOT = import.meta.dirname;
const SERVER_ID = crypto.randomUUID();
const LIVERELOAD_PATH = '/__dev/livereload';

/** Path segments that are never served and never watched. */
const DENIED_SEGMENTS = new Set(['private', 'node_modules', '.git', '.claude']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// ---------------------------------------------------------------- args

function parseArgs(argv) {
  const opts = { port: Number(process.env.PORT) || 3000, open: false, host: 'localhost' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === '--port' || arg === '-p') && argv[i + 1]) opts.port = Number(argv[++i]);
    else if (arg.startsWith('--port=')) opts.port = Number(arg.slice(7));
    else if (arg === '--open' || arg === '-o') opts.open = true;
    else if (arg === '--host' && argv[i + 1]) opts.host = argv[++i];
  }
  if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535) {
    console.error(`Invalid port: ${opts.port}`);
    process.exit(1);
  }
  return opts;
}

const options = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------- helpers

const isDenied = (relPath) =>
  relPath
    .split(path.sep)
    .filter(Boolean)
    .some((segment) => DENIED_SEGMENTS.has(segment) || (segment.startsWith('.') && segment !== '.'));

/**
 * Map a request URL to an on-disk file, or return null when it escapes the
 * site root, hits a denied path, or does not exist.
 */
async function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }

  const target = path.resolve(ROOT, '.' + path.posix.normalize(decoded));
  const rel = path.relative(ROOT, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (isDenied(rel)) return null;

  let stats;
  try {
    stats = await fsp.stat(target);
  } catch {
    return null;
  }

  if (stats.isDirectory()) {
    if (!decoded.endsWith('/')) return { redirect: decoded + '/' };
    const indexFile = path.join(target, 'index.html');
    try {
      const indexStats = await fsp.stat(indexFile);
      return { file: indexFile, stats: indexStats };
    } catch {
      return null;
    }
  }

  return { file: target, stats };
}

const LIVERELOAD_SNIPPET = `
<script>
(() => {
  const ENDPOINT = ${JSON.stringify(LIVERELOAD_PATH)};
  let serverId = null;
  const source = new EventSource(ENDPOINT);

  source.addEventListener('hello', (event) => {
    const id = JSON.parse(event.data).serverId;
    if (serverId && serverId !== id) location.reload();
    serverId = id;
  });

  source.addEventListener('reload', () => location.reload());

  source.addEventListener('css', () => {
    for (const link of document.querySelectorAll('link[rel="stylesheet"][href]')) {
      const url = new URL(link.href, location.href);
      // Only local stylesheets change during development.
      if (url.origin !== location.origin) continue;
      url.searchParams.set('__reload', Date.now().toString());
      const fresh = link.cloneNode();
      fresh.href = url.href;
      fresh.addEventListener('load', () => link.remove(), { once: true });
      link.parentNode.insertBefore(fresh, link.nextSibling);
    }
  });
})();
</script>
`;

const errorPage = (code, title, message) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${code} — ${title}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#f6f7fb; color:#0f172a;
         font: 400 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { text-align:center; padding:2rem; max-width:34rem; }
  .code { font-size:4rem; font-weight:800; letter-spacing:-.04em; color:#0f766e; margin:0; }
  h1 { font-size:1.25rem; margin:.25rem 0 .5rem; }
  p { color:#64748b; margin:0 0 1.5rem; }
  a { color:#0f766e; font-weight:600; }
  @media (prefers-color-scheme: dark) { body { background:#0b1120; color:#e2e8f0; } .code,a { color:#2dd4bf; } p { color:#94a3b8; } }
</style></head>
<body><main><p class="code">${code}</p><h1>${title}</h1><p>${message}</p><a href="/">← Back to Rojaco</a></main></body></html>`;

// ---------------------------------------------------------------- SSE clients

/** @type {Set<import('node:http').ServerResponse>} */
const clients = new Set();

function broadcast(event) {
  for (const client of clients) {
    client.write(`event: ${event}\ndata: {}\n\n`);
  }
}

// ---------------------------------------------------------------- request handling

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === LIVERELOAD_PATH) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.write(`retry: 500\n`);
    res.write(`event: hello\ndata: ${JSON.stringify({ serverId: SERVER_ID })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': MIME['.html'], Allow: 'GET, HEAD' });
    res.end(errorPage(405, 'Method not allowed', 'This dev server only serves GET requests.'));
    return;
  }

  const resolved = await resolveFile(urlPath);

  if (resolved?.redirect) {
    res.writeHead(301, { Location: resolved.redirect });
    res.end();
    return;
  }

  if (!resolved) {
    log(req.method, urlPath, 404);
    res.writeHead(404, { 'Content-Type': MIME['.html'] });
    res.end(req.method === 'HEAD' ? '' : errorPage(404, 'Not found', `Nothing is served at <code>${escapeHtml(urlPath)}</code>.`));
    return;
  }

  const ext = path.extname(resolved.file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  log(req.method, urlPath, 200);

  // HTML gets the live-reload client injected; everything else streams as-is.
  if (ext === '.html') {
    const html = await fsp.readFile(resolved.file, 'utf8');
    const body = html.includes('</body>')
      ? html.replace('</body>', `${LIVERELOAD_SNIPPET}</body>`)
      : html + LIVERELOAD_SNIPPET;
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? '' : body);
    return;
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': resolved.stats.size,
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(resolved.file).pipe(res);
});

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function log(method, urlPath, status) {
  const colour = status >= 400 ? '\x1b[31m' : '\x1b[32m';
  console.log(`  ${colour}${status}\x1b[0m ${method} ${urlPath}`);
}

// ---------------------------------------------------------------- watching

function startWatching() {
  let timer = null;
  let cssOnly = true;

  try {
    fs.watch(ROOT, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const rel = filename.toString();
      if (isDenied(rel)) return;

      // Editing the server itself needs a manual restart, so say so rather
      // than reloading the browser onto unchanged output.
      if (rel === 'server.js') {
        console.log('  \x1b[33m⚠\x1b[0m server.js changed — restart `npm run dev` to apply');
        return;
      }

      if (!/\.(html|css|js|mjs|json|svg|png|jpe?g|webp)$/i.test(rel)) return;

      cssOnly = cssOnly && rel.toLowerCase().endsWith('.css');
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.log(`  \x1b[36m↻\x1b[0m ${rel} → ${cssOnly ? 'css hot-swap' : 'reload'}`);
        broadcast(cssOnly ? 'css' : 'reload');
        cssOnly = true;
      }, 80);
    });
  } catch (error) {
    console.warn(`  ⚠ Live reload unavailable: ${error.message}`);
  }
}

// ---------------------------------------------------------------- boot

function listen(port, attemptsLeft = 10) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log(`  Port ${port} in use, trying ${port + 1}…`);
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    console.error(error.message);
    process.exit(1);
  });

  server.listen(port, options.host, () => {
    const url = `http://${options.host}:${port}/`;
    console.log('');
    console.log('  \x1b[1m\x1b[36mRojaco\x1b[0m dev server');
    console.log(`  ➜  \x1b[1m${url}\x1b[0m`);
    console.log('  ➜  live reload enabled · press Ctrl+C to stop');
    console.log(`  ➜  not served: ${[...DENIED_SEGMENTS].join(', ')}`);
    console.log('');
    startWatching();
    if (options.open) spawn(openCommand(), [url], { stdio: 'ignore', detached: true }).unref();
  });
}

const openCommand = () =>
  process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const client of clients) client.end();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 300).unref();
  });
}

listen(options.port);
