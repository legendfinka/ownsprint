import { Link, useLocation, useNavigate } from 'react-router';
import { loginSchema } from '@ownsprint/shared';
import { ErrorText } from '@/components/ErrorText';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { useSchemaForm } from '@/lib/forms';
import { AuthCard } from './AuthCard';
import { useLogin } from './session';

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/projects';

  const { errors, onSubmit } = useSchemaForm(loginSchema, async (input) => {
    await login.mutateAsync(input);
    await navigate(from, { replace: true });
  });

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
        <ErrorText>{login.error?.message}</ErrorText>
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
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
