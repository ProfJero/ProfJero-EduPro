/** Cloudinary signing helpers (Web Crypto, no SDK needed). */
export async function sha1Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cloudinary API/upload signature: sorted "k=v&k2=v2" + api_secret, SHA-1 hex. */
export async function signParams(params: Record<string, string | number | undefined>, secret: string): Promise<string> {
  const str = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return sha1Hex(str + secret);
}

/** Time-limited download URL for authenticated/private assets. */
export async function privateDownloadUrl(o: { cloud: string; apiKey: string; secret: string; publicId: string; resourceType: string; format?: string | null; type: string; ttlSeconds: number }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number | undefined> = {
    public_id: o.publicId, format: o.format || undefined, type: o.type, timestamp, expires_at: timestamp + o.ttlSeconds,
  };
  const signature = await signParams(params, o.secret);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  q.set('api_key', o.apiKey);
  q.set('signature', signature);
  return `https://api.cloudinary.com/v1_1/${o.cloud}/${o.resourceType}/download?${q.toString()}`;
}
