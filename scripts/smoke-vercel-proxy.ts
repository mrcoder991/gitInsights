async function main(): Promise<void> {
  const url = process.env.VERCEL_PROXY_SMOKE_URL;
  const origin = process.env.VERCEL_PROXY_ALLOWED_ORIGIN;

  if (!url || !origin) {
    console.log('smoke: skip (set VERCEL_PROXY_SMOKE_URL and VERCEL_PROXY_ALLOWED_ORIGIN)');
    return;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ code: 'gi_invalid_oauth_code_smoke' }),
  });

  const body: unknown = await res.json();
  if (res.status !== 400) {
    console.error('smoke: expected status 400, got', res.status);
    process.exit(1);
  }
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    console.error('smoke: expected JSON body with error from GitHub');
    process.exit(1);
  }
  console.log('smoke: ok');
}

void main();
