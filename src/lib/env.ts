export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  cloudinaryCloud: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? '',
  apiBase: (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, ''),
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '',
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const uploadsEnabled = Boolean(env.cloudinaryCloud);
