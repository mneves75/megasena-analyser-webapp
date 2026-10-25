import { LoadingState } from '@/components/loading-state';
import { pt } from '@/lib/i18n';

// Scoped to the home route group on purpose. A root app/loading.tsx wraps every
// route in Suspense, so the shell streams with HTTP 200 before a page can call
// notFound() or permanentRedirect(): invalid /concurso, /numeros and /resultados
// URLs would become soft 404s and padded aliases client-side redirects.
export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <LoadingState title={pt.loading.app.title} />
      </div>
    </div>
  );
}
