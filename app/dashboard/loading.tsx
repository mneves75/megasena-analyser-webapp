import { LoadingState } from '@/components/loading-state';
import { pt } from '@/lib/i18n';

export default function Loading() {
  return <LoadingState title={pt.loading.dashboard.title} />;
}
