import { LoadingState } from '@/components/loading-state';
import { pt } from '@/lib/i18n';

export default function Loading() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <LoadingState title={pt.loading.dashboard.title} />
    </div>
  );
}
