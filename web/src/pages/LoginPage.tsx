import { useState } from 'react';
import type { FormEvent } from 'react';

import { IconLock } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Misc';
import { ApiError } from '@/lib/api';
import { useLogin } from '@/lib/queries';

export function LoginPage() {
  const login = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }

    login.mutate(
      { username: username.trim(), password },
      {
        onError: (mutationError) => {
          setError(
            mutationError instanceof ApiError
              ? mutationError.message
              : 'Sign in failed. Please try again.'
          );
          setPassword('');
        },
      }
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[820px] max-w-[140vw] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            'linear-gradient(135deg, var(--app-hero-start), var(--app-hero-mid), var(--app-hero-end))',
        }}
      />

      <div className="bg-card/90 border-line rounded-sheet shadow-mac-lg relative w-full max-w-[400px] border p-7 backdrop-blur-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/icon.png" alt="" width={56} height={56} className="rounded-card" />
          <div>
            <h1 className="font-display text-ink text-[20px] font-extrabold">Excel Driving School</h1>
            <p className="text-muted mt-0.5 text-[12.5px]">Client Management System</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <Field id="username" label="Username">
            <TextInput
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              disabled={login.isPending}
            />
          </Field>

          <Field id="password" label="Password">
            <TextInput
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={login.isPending}
            />
          </Field>

          {error ? (
            <p className="text-sys-red text-[12.5px] font-medium" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" className="w-full" disabled={login.isPending}>
            {login.isPending ? <Spinner className="border-white/40 border-t-white" /> : <IconLock size={15} />}
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-muted mt-6 text-center text-[11.5px] leading-relaxed">
          Accounts are created by your administrator. Ask them to run
          <code className="bg-field mx-1 rounded px-1.5 py-0.5">user:add</code>
          if you need access.
        </p>
      </div>
    </div>
  );
}
