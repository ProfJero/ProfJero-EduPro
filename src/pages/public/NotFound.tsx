import { Compass } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';

export function NotFound() {
  return (
    <div className="container-page py-20">
      <EmptyState icon={<Compass className="h-7 w-7" />} title="We couldn't find that page" description="The link may be broken or the page may have moved."
        action={<div className="flex gap-2"><ButtonLink to="/">Home</ButtonLink><ButtonLink to="/courses" variant="outline">Explore courses</ButtonLink></div>} />
    </div>
  );
}
