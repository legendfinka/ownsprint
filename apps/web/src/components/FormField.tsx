import type { ComponentProps } from 'react';
import { ErrorText } from '@/components/ErrorText';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props extends ComponentProps<'input'> {
  name: string;
  label: string;
  error?: string;
}

// Label + input + error message, wired together for screen readers.
export function FormField({ name, label, error, ...inputProps }: Props) {
  const errorId = `${name}-error`;
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      <ErrorText id={errorId}>{error}</ErrorText>
    </div>
  );
}
