import { PageHeader } from '@/components/ui';
import { CourseBrowser } from '@/pages/public/Catalog';

export function Explore() {
  return (
    <div>
      <PageHeader title="Explore courses" description="Find your next course. Free courses can be joined instantly." />
      <CourseBrowser linkPrefix="/courses/" />
    </div>
  );
}
