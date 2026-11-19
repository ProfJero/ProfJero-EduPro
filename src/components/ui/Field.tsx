import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, cloneElement, isValidElement, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

const control =
  'block w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 placeholder:text-ink-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-500 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-100';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, 'h-11', className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...p }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'min-h-[5rem] resize-y', className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(control, 'h-11 pr-9', className)} {...p}>
      {children}
    </select>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }>(function Checkbox({ label, description, className, ...p }, ref) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input ref={ref} id={p.id ?? id} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-ink-300 accent-brand-600" {...p} />
      <label htmlFor={p.id ?? id} className="text-sm text-ink-700">
        <span className="font-medium text-ink-800">{label}</span>
        {description && <span className="block text-ink-500">{description}</span>}
      </label>
    </div>
  );
});

/** Label + control + hint + accessible error. The child control receives id/aria props. */
export function Field({ label, hint, error, required, children, className }: { label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; children: ReactElement; className?: string }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined,
        'aria-required': required || undefined,
      })
    : children;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink-800">
        {label}
        {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
      </label>
      {child}
      {hint && !error && <p id={hintId} className="text-xs text-ink-500">{hint}</p>}
      {error && <p id={errId} role="alert" className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
