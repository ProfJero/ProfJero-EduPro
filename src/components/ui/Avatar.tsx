import { cn, initials } from '@/lib/utils';
import { cldUrl } from '@/lib/media';

const palette = ['bg-brand-100 text-brand-800', 'bg-growth-100 text-growth-700', 'bg-sun-100 text-sun-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700'];
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, src, size = 36, className, ring }: { name?: string | null; src?: string | null; size?: number; className?: string; ring?: 'online' | 'hand' | null }) {
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.38) };
  const ringCls = ring === 'online' ? 'ring-2 ring-growth-500 ring-offset-2' : ring === 'hand' ? 'ring-2 ring-sun-400 ring-offset-2' : '';
  if (src) {
    return <img src={cldUrl(src, { w: size * 2, h: size * 2, crop: 'fill', gravity: 'face' })} alt={name ? `${name}` : ''} width={size} height={size} loading="lazy" className={cn('shrink-0 rounded-full object-cover', ringCls, className)} style={style} />;
  }
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold', palette[hash(name ?? '?') % palette.length], ringCls, className)} style={style} aria-label={name ?? undefined} role={name ? 'img' : undefined}>
      {initials(name)}
    </span>
  );
}
