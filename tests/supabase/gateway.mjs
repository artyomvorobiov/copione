// Minimal stand-in for Supabase's API gateway (Kong) used by the integration
// tests: routes /auth/v1/* to GoTrue and /rest/v1/* to PostgREST.
import http from 'node:http';

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const routes = [
  { prefix: '/auth/v1', target: { host: '127.0.0.1', port: 9999 } },
  { prefix: '/rest/v1', target: { host: '127.0.0.1', port: 3000 } },
];

// Lower-case keys so they replace (not duplicate) the upstream CORS headers.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': 'Content-Range, X-Total-Count',
};

http
  .createServer((req, res) => {
    // Browsers (the web build) need CORS, like Supabase's real gateway provides.
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS).end();
      return;
    }
    const route = routes.find((r) => req.url.startsWith(r.prefix));
    if (!route) {
      res.writeHead(404).end('no route');
      return;
    }
    const upstream = http.request(
      {
        ...route.target,
        method: req.method,
        path: req.url.slice(route.prefix.length) || '/',
        headers: { ...req.headers, host: `${route.target.host}:${route.target.port}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...CORS });
        up.pipe(res);
      },
    );
    upstream.on('error', (err) => {
      res.writeHead(502).end(String(err));
    });
    req.pipe(upstream);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`gateway listening on http://127.0.0.1:${PORT}`);
  });
