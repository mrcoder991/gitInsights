// Local dev harness for the Vercel token-exchange function. Runs `api/authenticate.ts`
// behind a plain `http.createServer` on :3000 so the SPA at :5173 has a real
// proxy to POST to, with the *same* env-var contract (`GITHUB_CLIENT_ID`,
// `GITHUB_CLIENT_SECRET`, `ALLOWED_ORIGIN`) the deployed function uses.
//
// Why not `vercel dev`? `vercel dev` assumes there's a long-running framework
// dev server it can wrap; ours is static + GH Pages, so Vercel spins forever
// "detecting a port". This shim sidesteps that — it doesn't care about framework
// detection, it just calls our handler.
//
// Run it via `npm run dev:proxy` (see package.json). Env vars come from
// `.env.proxy.local` via Node 22's `--env-file` flag; populate that file with
// the same values you have in Vercel's Development environment (either by hand
// or via `vercel env pull .env.proxy.local --environment=development`).

import http from 'node:http';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import handler from '../api/authenticate.ts';

const PORT = Number(process.env.PORT ?? 3000);
const ROUTE = '/api/authenticate';

const server = http.createServer(async (req, res) => {
  // Only the one route is implemented; anything else is a 404 so you don't
  // accidentally think the SPA is being served here too.
  const url = req.url?.split('?')[0] ?? '/';
  if (url !== ROUTE) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'not_found', hint: `only ${ROUTE} is served` }));
    return;
  }

  // Buffer the request body and mimic Vercel's auto-JSON-parse behavior so
  // `req.body.code` works inside the handler without any conditionals.
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const contentType = String(req.headers['content-type'] ?? '');

  let parsedBody: unknown = raw;
  if (contentType.includes('application/json') && raw.length > 0) {
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      parsedBody = {};
    }
  }

  // Shim VercelRequest / VercelResponse on top of the native Node objects.
  // The handler only uses `req.method`, `req.headers`, `req.body`, `req.socket`,
  // plus `res.status()`, `res.json()`, `res.setHeader()`, `res.end()` — so this
  // is the minimal surface we need to fake.
  const vercelReq = req as unknown as VercelRequest;
  (vercelReq as unknown as { body: unknown }).body = parsedBody;

  const vercelRes = res as unknown as VercelResponse & {
    status: (code: number) => VercelResponse;
    json: (body: unknown) => VercelResponse;
  };
  vercelRes.status = (code: number) => {
    res.statusCode = code;
    return vercelRes;
  };
  vercelRes.json = (body: unknown) => {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(body));
    return vercelRes;
  };

  try {
    await handler(vercelReq, vercelRes);
  } catch (err) {
    console.error('[dev-proxy] handler threw:', err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'handler_exception' }));
    }
  }
});

server.listen(PORT, () => {
  const clientIdSet = Boolean(process.env.GITHUB_CLIENT_ID);
  const clientSecretSet = Boolean(process.env.GITHUB_CLIENT_SECRET);
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  console.log(`[dev-proxy] listening at http://localhost:${PORT}${ROUTE}`);
  console.log('[dev-proxy] env check:');
  console.log(`  GITHUB_CLIENT_ID      ${clientIdSet ? 'set' : 'MISSING'}`);
  console.log(`  GITHUB_CLIENT_SECRET  ${clientSecretSet ? 'set' : 'MISSING'}`);
  console.log(`  ALLOWED_ORIGIN        ${allowedOrigin ?? 'MISSING'}`);
  if (!clientIdSet || !clientSecretSet || !allowedOrigin) {
    console.warn(
      '[dev-proxy] env vars missing — requests will 500 with proxy_misconfigured. ' +
        'Populate .env.proxy.local (see .env.proxy.example).',
    );
  }
});

// Graceful shutdown so Ctrl-C exits immediately without the socket draining delay.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
