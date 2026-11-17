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
// and calls onValid with the parsed data. If onValid fails, the API's field
// errors go under their fields, anything else (e.g. "Email already taken")
// into `formError`.
export function useSchemaForm<T>(
  schema: Schema<T>,
  onValid: (data: T, form: HTMLFormElement) => Promise<unknown>,
) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = schema.safeParse(readForm(form));
    setErrors(result.success ? {} : firstErrors(result.error.issues));
    setFormError(undefined);
    if (!result.success) return;

    onValid(result.data, form).catch((error: unknown) => {
      const fieldErrors = fromApiError(error);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        setFormError(error instanceof Error ? error.message : 'Something went wrong');
      }
    });
  }

  return { errors, formError, onSubmit };
}

// One line for an error: the first field error if there is one
// ("Too big: expected number to be <=100"), else the general message.
export function errorMessage(error: unknown): string {
  const [first] = Object.values(fromApiError(error));
  if (first) return first;
  return error instanceof Error ? error.message : 'Something went wrong';
}

function fromApiError(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {};
  const details = error.details as
    | { body?: { fieldErrors?: Record<string, string[]> } }
    | undefined;
  const fields = Object.entries(details?.body?.fieldErrors ?? {});
  return Object.fromEntries(fields.map(([field, messages]) => [field, messages[0]]));
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
