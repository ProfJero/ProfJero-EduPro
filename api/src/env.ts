export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  APP_URL?: string; // e.g. https://profjero-edupro.pages.dev
  ALLOWED_ORIGINS?: string; // comma separated
  WORKER_SECRET?: string; // shared with private.app_config in the database
  ANTHROPIC_API_KEY?: string;
  VAPID_PUBLIC_KEY?: string; // base64url, uncompressed P-256 point
  VAPID_PRIVATE_KEY?: string; // JWK JSON
  VAPID_SUBJECT?: string;
  ZOOM_CLIENT_ID?: string;
  ZOOM_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  JAAS_APP_ID?: string;
  JAAS_KID?: string;
  JAAS_PRIVATE_KEY?: string; // PKCS#8 PEM
  JUDGE0_URL?: string;
  JUDGE0_KEY?: string;
  JUDGE0_KEY_HEADER?: string; // default X-Auth-Token (use X-RapidAPI-Key for RapidAPI)
}
