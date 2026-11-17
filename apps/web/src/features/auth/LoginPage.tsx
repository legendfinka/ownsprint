import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { DEMO_ACCOUNT, loginSchema } from '@ownsprint/shared';
import { ErrorText } from '@/components/ErrorText';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { errorMessage, useSchemaForm } from '@/lib/forms';
import { AuthCard } from './AuthCard';
import { useLogin } from './session';

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/projects';

  const { errors, formError, onSubmit } = useSchemaForm(loginSchema, async (input) => {
    await login.mutateAsync(input);
    await navigate(from, { replace: true });
  });

  // One click into the sample project, no sign-up needed.
  const [demoError, setDemoError] = useState<string>();
  async function tryDemo() {
    setDemoError(undefined);
    try {
      await login.mutateAsync({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password });
      await navigate(from, { replace: true });
    } catch (error) {
      setDemoError(errorMessage(error));
    }
  }

  return (
    <AuthCard title="Log in" description="Welcome back to OwnSprint.">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email}
        />
        <FormField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password}
        />
        <ErrorText>{formError}</ErrorText>
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={login.isPending}
          onClick={() => void tryDemo()}
        >
          Try demo account
        </Button>
        <ErrorText>{demoError}</ErrorText>
        {login.isPending && (
          <p role="status" className="text-center text-xs text-muted-foreground">
            The free server may need up to a minute to wake up.
          </p>
        )}
        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link to="/register" className="underline">
            Sign up
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
