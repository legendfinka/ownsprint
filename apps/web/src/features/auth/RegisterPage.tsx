import { Link, useNavigate } from 'react-router';
import { registerSchema } from '@ownsprint/shared';
import { ErrorText } from '@/components/ErrorText';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { useSchemaForm } from '@/lib/forms';
import { AuthCard } from './AuthCard';
import { useRegister } from './session';

export function RegisterPage() {
  const register = useRegister();
  const navigate = useNavigate();

  const { errors, formError, onSubmit } = useSchemaForm(registerSchema, async (input) => {
    await register.mutateAsync(input);
    await navigate('/projects', { replace: true });
  });

  return (
    <AuthCard title="Create an account" description="Start planning sprints in a minute.">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField name="name" label="Name" autoComplete="name" error={errors.name} />
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
          autoComplete="new-password"
          error={errors.password}
        />
        <ErrorText>{formError}</ErrorText>
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Creating account…' : 'Sign up'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
