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
// `id` defaults to the name; set it when two forms on a page share a field name.
export function FormField({ name, label, error, id = name, ...inputProps }: Props) {
  const errorId = `${id}-error`;
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      <ErrorText id={errorId}>{error}</ErrorText>
    </div>
  );
}
