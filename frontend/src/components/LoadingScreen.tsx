import { Loader2 } from 'lucide-react';

export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-field text-ink">
      <div className="flex items-center gap-3 text-sm text-ink/70">
        <Loader2 className="h-5 w-5 animate-spin text-spruce" aria-hidden="true" />
        Loading workspace
      </div>
    </main>
  );
}
