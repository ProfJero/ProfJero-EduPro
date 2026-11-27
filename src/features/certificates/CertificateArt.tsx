import { fmtDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

export type CertTemplate = {
  id?: string; name?: string; accent_color: string; signatory_name: string | null; signatory_title: string | null; footer_text: string | null;
  style?: 'classic' | 'modern' | 'kente' | 'minimal'; title_text?: string; intro_text?: string; body_text?: string;
  logo_url?: string | null; signature_url?: string | null; seal_text?: string | null;
};
export const TEMPLATE_SELECT = 'id, name, accent_color, signatory_name, signatory_title, footer_text, style, title_text, intro_text, body_text, logo_url, signature_url, seal_text';

/** The certificate itself (A4 landscape ratio), drawn from the template settings. */
export function CertificateArt({ t, learner, course, issuer, completed, serial, revoked, verifyUrl }: {
  t: CertTemplate | null; learner: string; course: string; issuer: string; completed: string; serial: string; revoked?: boolean; verifyUrl: string;
}) {
  const accent = t?.accent_color ?? '#1554D6';
  const style = t?.style ?? 'classic';
  const kente = `repeating-linear-gradient(90deg, #ce1126 0 14px, #fcd116 14px 28px, #006b3f 28px 42px, #111 42px 46px, #fcd116 46px 60px)`;
  return (
    <div className={cn('relative mx-auto aspect-[297/210] w-full max-w-[297mm] overflow-hidden bg-white text-[#0f172a] shadow-xl print:shadow-none', style === 'minimal' ? 'p-[6%]' : 'p-[4.5%]')}
      style={style === 'classic' ? { border: `10px solid ${accent}` } : style === 'modern' ? { borderLeft: `28px solid ${accent}` } : undefined} data-no-contrast>
      {style === 'kente' && <><div className="absolute inset-x-0 top-0 h-[4%]" style={{ background: kente }} /><div className="absolute inset-x-0 bottom-0 h-[4%]" style={{ background: kente }} /></>}
      {style === 'modern' && <div className="absolute -right-[8%] -top-[18%] h-[55%] w-[35%] rounded-full opacity-10" style={{ background: accent }} />}
      <div className={cn('relative flex h-full flex-col items-center justify-between text-center', style === 'classic' && 'border-2 border-[#e2e8f0] p-[3.5%]', style === 'kente' && 'py-[3%]')}>
        <div className="flex items-center gap-3">
          {t?.logo_url ? <img src={t.logo_url} alt="" className="h-[clamp(2rem,6vw,3.5rem)] w-auto object-contain" /> : <img src="/brand/mark.webp" alt="" className="h-[clamp(2rem,5vw,3rem)] w-[clamp(2rem,5vw,3rem)]" />}
          <span className="text-[clamp(1rem,2.2vw,1.35rem)] font-extrabold">Prof<span style={{ color: accent }}>Jero</span> Edu</span>
        </div>
        <div>
          <p className="text-[clamp(0.6rem,1.3vw,0.9rem)] font-bold uppercase tracking-[0.35em] text-[#64748b]">{t?.title_text || 'Certificate of completion'}</p>
          <p className="mt-[3%] text-[clamp(0.7rem,1.4vw,1rem)] text-[#475569]">{t?.intro_text || 'This certifies that'}</p>
          <p className="mt-1 text-[clamp(1.4rem,4.4vw,3rem)] font-extrabold leading-tight" style={style === 'kente' ? { color: '#0f172a' } : undefined}>{learner}</p>
          <p className="mt-[2.5%] text-[clamp(0.7rem,1.4vw,1rem)] text-[#475569]">{t?.body_text || 'has successfully completed the course'}</p>
          <p className="mt-1 text-[clamp(1rem,2.6vw,1.6rem)] font-bold" style={{ color: accent }}>{course}</p>
          <p className="mt-[2%] text-[clamp(0.6rem,1.2vw,0.9rem)] text-[#475569]">on {fmtDate(completed, 'd MMMM yyyy')}</p>
        </div>
        <div className="grid w-full grid-cols-3 items-end gap-4 text-left text-[clamp(0.5rem,1vw,0.75rem)] text-[#475569]">
          <div>
            {t?.signature_url && <img src={t.signature_url} alt="" className="mb-1 h-[clamp(1.5rem,4vw,2.75rem)] w-auto object-contain" />}
            <p className="border-t border-[#cbd5e1] pt-1.5 font-semibold text-[#0f172a]">{t?.signatory_name || issuer}</p>
            {t?.signatory_title && <p>{t.signatory_title}</p>}
            {t?.signatory_name && <p>{issuer}</p>}
          </div>
          <div className="flex justify-center">
            {t?.seal_text && <span className="grid aspect-square w-[clamp(3rem,9vw,5.5rem)] place-items-center rounded-full border-4 border-double p-1 text-center text-[clamp(0.45rem,0.9vw,0.65rem)] font-extrabold uppercase leading-tight" style={{ borderColor: accent, color: accent }}>{t.seal_text}</span>}
          </div>
          <div className="text-right"><p>Reference <strong className="text-[#0f172a]">{serial}</strong></p><p className="break-all">Verify at {verifyUrl}</p>
            {t?.footer_text && <p className="mt-1">{t.footer_text}</p>}{revoked && <p className="font-bold text-[#dc2626]">REVOKED</p>}</div>
        </div>
      </div>
    </div>
  );
}
