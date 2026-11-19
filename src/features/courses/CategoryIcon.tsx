import { BookOpen, BrainCircuit, Briefcase, ClipboardCheck, Code, FlaskConical, Landmark, Languages, Monitor, Presentation, Rocket, Sigma, type LucideIcon } from 'lucide-react';

const map: Record<string, LucideIcon> = {
  sigma: Sigma, languages: Languages, 'flask-conical': FlaskConical, monitor: Monitor, code: Code, 'brain-circuit': BrainCircuit,
  briefcase: Briefcase, landmark: Landmark, 'clipboard-check': ClipboardCheck, presentation: Presentation, rocket: Rocket, 'book-open': BookOpen,
};
export const categoryIconNames = Object.keys(map);
export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const I = (name && map[name]) || BookOpen;
  return <I className={className} aria-hidden />;
}
