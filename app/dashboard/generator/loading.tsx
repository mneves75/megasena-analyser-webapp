import { LoadingState } from '@/components/loading-state';
import { pt } from '@/lib/i18n';

export default function Loading() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <LoadingState
        title={pt.loading.generator.title}
        description={pt.loading.generator.description}
        cardCount={2}
        lineCount={4}
      />
    </div>
  );
}
