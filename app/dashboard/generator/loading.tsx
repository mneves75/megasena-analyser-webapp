import { LoadingState } from '@/components/loading-state';
import { pt } from '@/lib/i18n';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <LoadingState
          title={pt.loading.generator.title}
          description={pt.loading.generator.description}
          cardCount={2}
          lineCount={4}
        />
      </div>
    </div>
  );
}
