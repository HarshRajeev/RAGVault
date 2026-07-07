'use client';

import { Lock, Mail } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/classNames';

type AuthMode = 'signin' | 'signup';

export function AuthGate() {
  const { signIn, signUp, authError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');

    if (!email.trim() || password.length < 6) {
      setLocalError('Use a valid email and a password with at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const action = mode === 'signin' ? signIn : signUp;
      await action({ email: email.trim(), password });
    } catch {
      // AuthContext exposes the provider message.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-field text-ink">
      <section className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="rounded border border-ink/10 bg-white p-6 shadow-toolbar">
          <div className="mb-6">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-moss">
              Document Q&A
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded border border-ink/10 bg-field p-1">
            <button
              type="button"
              className={cn(
                'h-9 rounded text-sm font-medium transition',
                mode === 'signin' ? 'bg-white text-spruce shadow-toolbar' : 'text-ink/60 hover:text-ink',
              )}
              disabled={isSubmitting}
              onClick={() => setMode('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={cn(
                'h-9 rounded text-sm font-medium transition',
                mode === 'signup' ? 'bg-white text-spruce shadow-toolbar' : 'text-ink/60 hover:text-ink',
              )}
              disabled={isSubmitting}
              onClick={() => setMode('signup')}
            >
              Create account
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/75">Email</span>
              <span className="flex h-11 items-center rounded border border-ink/20 bg-white px-3 focus-within:border-spruce">
                <Mail className="h-4 w-4 text-ink/40" aria-hidden="true" />
                <input
                  className="ml-2 h-full min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                  type="email"
                  autoComplete="email"
                  value={email}
                  disabled={isSubmitting}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/75">Password</span>
              <span className="flex h-11 items-center rounded border border-ink/20 bg-white px-3 focus-within:border-spruce">
                <Lock className="h-4 w-4 text-ink/40" aria-hidden="true" />
                <input
                  className="ml-2 h-full min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  disabled={isSubmitting}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </span>
            </label>

            {(localError || authError) && (
              <p className="rounded border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
                {localError || authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded bg-spruce px-4 text-sm font-semibold text-white transition hover:bg-spruce/90 disabled:cursor-not-allowed disabled:bg-ink/30"
            >
              {isSubmitting ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
