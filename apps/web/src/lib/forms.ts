import { useState, type FormEvent } from 'react';
import { ApiError } from './api';

// Field name → first error message, e.g. { email: 'Invalid email address' }.
export type FieldErrors = Partial<Record<string, string>>;

interface Issue {
  path: PropertyKey[];
  message: string;
}

// Any shared Zod schema fits this shape.
interface Schema<T> {
  safeParse(
    input: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: Issue[] } };
}

// Checks a submitted form with a shared schema (the same one the API uses)
// and calls onSubmit with the parsed data. Field errors from the schema, or
// from the API if onSubmit's promise is rejected, show up in `errors`.
export function useSchemaForm<T>(
  schema: Schema<T>,
  onValid: (data: T, form: HTMLFormElement) => Promise<unknown>,
) {
  const [errors, setErrors] = useState<FieldErrors>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = schema.safeParse(readForm(form));
    if (!result.success) {
      setErrors(firstErrors(result.error.issues));
      return;
    }
    setErrors({});
    onValid(result.data, form).catch((error: unknown) => setErrors(fromApiError(error)));
  }

  return { errors, onSubmit };
}

function fromApiError(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {};
  const details = error.details as
    { body?: { fieldErrors?: Record<string, string[]> } } | undefined;
  return Object.fromEntries(
    Object.entries(details?.body?.fieldErrors ?? {}).map(([field, messages]) => [
      field,
      messages[0],
    ]),
  );
}

function firstErrors(issues: Issue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
}

function readForm(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value === 'string') values[key] = value; // skip file inputs
  });
  return values;
}
