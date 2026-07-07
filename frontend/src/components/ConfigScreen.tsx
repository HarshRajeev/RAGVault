import { AlertTriangle } from 'lucide-react';

export function ConfigScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-field px-4 py-10 text-ink">
      <section className="w-full max-w-xl rounded border border-marigold/40 bg-white p-6 shadow-toolbar">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-marigold" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold">Supabase configuration required</h1>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              Add these values to <span className="font-mono">frontend/.env.local</span>, then
              restart Next.js.
            </p>
            <dl className="mt-4 space-y-2 rounded border border-ink/10 bg-field p-3 text-sm">
              <div>
                <dt className="font-mono text-ink">NEXT_PUBLIC_SUPABASE_URL</dt>
                <dd className="text-ink/60">Your Supabase project URL</dd>
              </div>
              <div>
                <dt className="font-mono text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</dt>
                <dd className="text-ink/60">The public anon key from Supabase settings</dd>
              </div>
              <div>
                <dt className="font-mono text-ink">NEXT_PUBLIC_API_BASE_URL</dt>
                <dd className="text-ink/60">The FastAPI base URL ending in /api</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
