import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { CalendarPlus } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { createSprintSchema } from '@ownsprint/shared';
import { ErrorText } from '@/components/ErrorText';
import { FormField } from '@/components/FormField';
import { Select } from '@/components/Select';
import { Window } from '@/components/Window';
import { Button, buttonVariants } from '@/components/ui/button';
import { useSchemaForm } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { Board } from './Board';
import { useCreateSprint, useSprints } from './queries';

// Sprint picker + the board of the chosen sprint. The choice lives in the
// URL (?sprint=…), so a reload or a shared link opens the same board.
export function SprintBoard({ projectId }: { projectId: string }) {
  const { data: sprints, isPending, error } = useSprints(projectId);
  const [params, setParams] = useSearchParams();

  if (isPending) return <p className="text-sm text-muted-foreground">Loading sprints…</p>;
  if (error) return <ErrorText>{error.message}</ErrorText>;

  // The sprint from the URL, else the active one, else the first.
  const sprint =
    sprints.find((s) => s.id === params.get('sprint')) ??
    sprints.find((s) => s.status === 'active') ??
    sprints[0];
  const select = (sprintId: string) => setParams({ sprint: sprintId }, { replace: true });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        {sprint ? (
          <Select
            aria-label="Sprint"
            value={sprint.id}
            onChange={(e) => select(e.target.value)}
            className="w-auto font-semibold"
          >
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.status}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground">No sprints yet. Create one to start.</p>
        )}
        <NewSprintButton projectId={projectId} onCreated={select} />
      </div>

      {sprint && <Board key={sprint.id} projectId={projectId} sprintId={sprint.id} />}
    </div>
  );
}

// "YYYY-MM-DD" in the user's time zone (toISOString would use UTC, which is
// yesterday or tomorrow for part of the day in most places).
function localDate(daysFromToday = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface NewSprintProps {
  projectId: string;
  onCreated: (sprintId: string) => void;
}

// Base UI's popover closes on an outside click or Escape and handles focus.
// The form unmounts on close, so it opens empty every time.
function NewSprintButton({ projectId, onCreated }: NewSprintProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={cn(buttonVariants({ variant: 'outline' }), 'shrink-0')}>
        New sprint
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="w-72 text-sm outline-none">
            <Window icon={CalendarPlus} title="New sprint" bar="bg-primary text-primary-foreground">
              <div className="p-4">
                <NewSprintForm
                  projectId={projectId}
                  onCreated={(sprintId) => {
                    setOpen(false);
                    onCreated(sprintId);
                  }}
                />
              </div>
            </Window>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NewSprintForm({ projectId, onCreated }: NewSprintProps) {
  const createSprint = useCreateSprint(projectId);
  const { errors, formError, onSubmit } = useSchemaForm(createSprintSchema, async (input) => {
    onCreated((await createSprint.mutateAsync(input)).id);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3">
        <FormField name="name" label="Name" placeholder="Sprint 1" error={errors.name} />
        <FormField
          name="startDate"
          label="Start"
          type="date"
          defaultValue={localDate()}
          error={errors.startDate}
        />
        <FormField
          name="endDate"
          label="End"
          type="date"
          defaultValue={localDate(13)}
          error={errors.endDate}
        />
      <ErrorText>{formError}</ErrorText>
      <Button type="submit" disabled={createSprint.isPending}>
        Create sprint
      </Button>
    </form>
  );
}
