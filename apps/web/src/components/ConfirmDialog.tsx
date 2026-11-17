import { useState, type ReactNode } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { TriangleAlert } from 'lucide-react';
import { ErrorText } from '@/components/ErrorText';
import { Window } from '@/components/Window';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/forms';

interface Props {
  trigger: ReactNode; // the button's label
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
}

// "Are you sure?" for destructive actions. An alert dialog: focus starts on
// Cancel, and it doesn't close on an outside click, so nothing is lost by accident.
export function ConfirmDialog({ trigger, title, description, confirmLabel, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err)); // stay open and say what went wrong
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger render={<Button variant="destructive" size="sm" />}>
        {trigger}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-1/2 outline-none">
          <Window
            icon={TriangleAlert}
            bar="bg-destructive text-primary-foreground"
            title={<AlertDialog.Title render={<span />}>{title}</AlertDialog.Title>}
          >
            <div className="grid gap-4 p-5 text-sm">
              <AlertDialog.Description>{description}</AlertDialog.Description>
              <ErrorText>{error}</ErrorText>
              <div className="flex justify-end gap-2">
                <AlertDialog.Close render={<Button variant="outline" />}>Cancel</AlertDialog.Close>
                <Button variant="destructive" onClick={() => void confirm()} disabled={pending}>
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </Window>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
