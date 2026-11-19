import { env } from './env';

type Opts = { w?: number; h?: number; crop?: 'fill' | 'limit' | 'fit'; gravity?: 'auto' | 'face' };

/**
 * Responsive, bandwidth-aware delivery for public Cloudinary images:
 * inserts f_auto,q_auto and size transformations. Non-Cloudinary URLs pass through.
 */
export function cldUrl(src: string, o: Opts = {}): string {
  if (!src.includes('res.cloudinary.com') || !src.includes('/upload/')) return src;
  const t = ['f_auto', 'q_auto', o.w && `w_${Math.round(o.w)}`, o.h && `h_${Math.round(o.h)}`, `c_${o.crop ?? 'limit'}`, o.gravity && `g_${o.gravity}`, 'dpr_1.0']
    .filter(Boolean)
    .join(',');
  return src.replace('/upload/', `/upload/${t}/`);
}

export function cldSrcSet(src: string, widths = [320, 640, 960, 1280]): string | undefined {
  if (!src.includes('res.cloudinary.com')) return undefined;
  return widths.map((w) => `${cldUrl(src, { w })} ${w}w`).join(', ');
}

/** Converts YouTube/Vimeo watch links to privacy-friendly embed URLs. */
export function videoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) return `https://www.youtube-nocookie.com/embed/${u.searchParams.get('v')}`;
    if (u.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/embed/')) return url.replace('youtube.com', 'youtube-nocookie.com');
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export const cloudinaryEnabled = () => Boolean(env.cloudinaryCloud);
