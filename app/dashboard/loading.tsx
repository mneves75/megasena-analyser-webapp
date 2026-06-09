import { LoadingState } from '@/components/loading-state';
import { pt } from '@/lib/i18n';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <LoadingState
          title={pt.loading.dashboard.title}
          description={pt.loading.dashboard.description}
          cardCount={4}
          lineCount={3}
        />
      </div>
    </div>
  );
}
