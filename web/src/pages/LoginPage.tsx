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
    <div className="login-page relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="relative flex flex-col items-center text-center">
        <img
          src="/icon.png"
          alt=""
          width={72}
          height={72}
          className="rounded-[18px] shadow-mac-lg"
        />
        <h1 className="text-ink mt-7 text-[32px] leading-[1.15] font-semibold">
          Excel Driving School
        </h1>
        <p className="text-muted mt-3 max-w-[34ch] text-[15px] leading-relaxed">
          Sign in
        </p>
      </div>

      <div className="relative mt-9 w-full max-w-[340px]">
        <form onSubmit={onSubmit} className="space-y-4">
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

          <Button
            type="submit"
            variant="primary"
            className="mt-2 h-11 w-full text-[14px]"
            disabled={login.isPending}
          >
            {login.isPending ? <Spinner className="border-white/40 border-t-white" /> : <IconLock size={15} />}
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

      </div>

      <p className="text-muted relative mt-8 max-w-[42ch] text-center text-[12px] leading-relaxed">
        Accounts are created by your administrator. Ask them to run
        <code className="bg-field border-line mx-1 rounded border px-1.5 py-0.5">user:add</code>
        if you need access.
      </p>
    </div>
  );
}
