// Vercel: POST /api/authenticate — GitHub OAuth code → token (client secret never exposed to the browser).
// CORS: exact match on ALLOWED_ORIGIN; no body/token logging; in-memory rate limit (best-effort per instance).

import type { VercelRequest, VercelResponse } from '@vercel/node';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

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

  if (!allowedOrigin || !clientId || !clientSecret) {
    res.status(500).json({ error: 'proxy_misconfigured' });
    return;
  }

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

  let payload: unknown;
  try {
    payload = await githubResponse.json();
  } catch {
    res.status(502).json({ error: 'upstream_invalid_json' });
    return;
  }

  console.log(`token_exchange status=${githubResponse.status}`);

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
