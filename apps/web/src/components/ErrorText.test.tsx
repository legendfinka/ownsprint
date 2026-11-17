import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorText } from './ErrorText';

// Moves the fake clock forward and lets React apply the state change.
function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('ErrorText', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('goes away after 5 seconds', () => {
    render(<ErrorText>Something broke</ErrorText>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke');

    wait(5000);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the same message again after it was cleared', () => {
    const { rerender } = render(<ErrorText>Name is required</ErrorText>);
    wait(5000);

    rerender(<ErrorText>{undefined}</ErrorText>);
    rerender(<ErrorText>Name is required</ErrorText>);

    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  });

  it('stays when persistent (a page that failed to load)', () => {
    render(<ErrorText persistent>Project not found</ErrorText>);

    wait(10_000);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
