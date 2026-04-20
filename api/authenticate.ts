// Vercel serverless function: exchanges a GitHub OAuth `code` for an
// `access_token`. The client secret never leaves this function — the SPA
// only ever sees the resulting token from GitHub. Spec refs: §3.A, §3.C, §5.
//
// Notes on hosting model:
// - File lives at `/api/authenticate.ts` so Vercel routes `POST
//   <deployment>/api/authenticate` here automatically (filesystem-based).
// - We deploy this from the same repo as the SPA but Vercel only builds the
//   `api/` directory; the SPA itself ships to GitHub Pages.
//
// Hard rules (from spec §3.C, §5, §6):
// - POST only; OPTIONS handled for CORS preflight; everything else → 405.
// - CORS origin is an *exact* match against ALLOWED_ORIGIN env var (no `*`).
// - Never log request bodies, tokens, codes, or PII — only status counts.
// - Best-effort in-memory token-bucket rate limit per client IP to deter abuse.
//   (Per-instance only; Vercel may run multiple cold instances. That's fine —
//   this is a deterrent, not a security boundary.)

import type { VercelRequest, VercelResponse } from '@vercel/node';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

// Token-bucket rate limit: 10 requests per IP per minute, refilling at
// `REFILL_PER_MS`. Cheap to implement, expensive enough to deter scripted
// abuse against a real OAuth client_id/secret pair.
const BUCKET_CAPACITY = 10;
const REFILL_PER_MS = BUCKET_CAPACITY / (60 * 1000);

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

function takeToken(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip) ?? { tokens: BUCKET_CAPACITY, updatedAt: now };
  const elapsed = now - bucket.updatedAt;
  bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + elapsed * REFILL_PER_MS);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(ip, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(ip, bucket);
  return true;
}

function clientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    // First entry is the originating client per the de-facto convention.
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

function applyCors(res: VercelResponse, allowedOrigin: string): void {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  // Fail closed if the deployment isn't configured — never silently
  // fall through to a misconfigured token exchange.
  if (!allowedOrigin || !clientId || !clientSecret) {
    res.status(500).json({ error: 'proxy_misconfigured' });
    return;
  }

  // Exact-match CORS. Browsers will reject anything else; we still set the
  // header explicitly so this is auditable and curl-friendly.
  const requestOrigin = req.headers.origin;
  if (requestOrigin && requestOrigin !== allowedOrigin) {
    res.status(403).json({ error: 'origin_not_allowed' });
    return;
  }
  applyCors(res, allowedOrigin);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (!takeToken(clientIp(req))) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  // Vercel auto-parses JSON bodies when Content-Type is application/json.
  // We accept either a parsed object or a string (defensive).
  const body =
    typeof req.body === 'string' && req.body.length > 0
      ? safeParseJson(req.body)
      : (req.body ?? {});
  const code = typeof body?.code === 'string' ? body.code : '';

  if (!code) {
    res.status(400).json({ error: 'missing_code' });
    return;
  }

  let githubResponse: Response;
  try {
    githubResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // GitHub's docs require a UA on server-to-server calls.
        'User-Agent': 'gitInsights-token-proxy',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
  } catch {
    res.status(502).json({ error: 'upstream_unreachable' });
    return;
  }

  // Pass GitHub's body back unchanged so the SPA can read `access_token`,
  // `scope`, `token_type`, or `error` / `error_description` directly.
  let payload: unknown;
  try {
    payload = await githubResponse.json();
  } catch {
    res.status(502).json({ error: 'upstream_invalid_json' });
    return;
  }

  // Status-code-only logging — no body, no token, no code, no PII.
  console.log(`token_exchange status=${githubResponse.status}`);

  // GitHub returns 200 for OAuth errors too (with `error` in the body).
  // Surface that as a 400 to the client so the UI can show the right state.
  if (
    githubResponse.ok &&
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload
  ) {
    res.status(400).json(payload);
    return;
  }

  res.status(githubResponse.status).json(payload);
}

function safeParseJson(input: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
