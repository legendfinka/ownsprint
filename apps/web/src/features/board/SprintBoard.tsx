import { useState, type ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';
import { CalendarPlus, Pencil } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { createSprintSchema, type CreateSprintInput, type Sprint } from '@ownsprint/shared';
import { ErrorText } from '@/components/ErrorText';
import { FormField } from '@/components/FormField';
import { Select } from '@/components/Select';
import { Window } from '@/components/Window';
import { Button, buttonVariants } from '@/components/ui/button';
import { SprintSummary } from '@/features/ai/SprintSummary';
import { useSchemaForm } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { Board } from './Board';
import { useCreateSprint, useSprints, useUpdateSprint } from './queries';
import { SprintActions } from './SprintActions';

// Sprint picker + the board of the chosen sprint. The choice lives in the
// URL (?sprint=…), so a reload or a shared link opens the same board.
export function SprintBoard({ projectId, isOwner }: { projectId: string; isOwner: boolean }) {
  const { data: sprints, isPending, error } = useSprints(projectId);
  const [params, setParams] = useSearchParams();

  if (isPending) return <p className="text-sm text-muted-foreground">Loading sprints…</p>;
  if (error) return <ErrorText persistent>{error.message}</ErrorText>;

  // The sprint from the URL, else the active one, else the first.
  const sprint =
    sprints.find((s) => s.id === params.get('sprint')) ??
    sprints.find((s) => s.status === 'active') ??
    sprints[0];
  const select = (sprintId: string) => setParams({ sprint: sprintId }, { replace: true });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {sprint ? (
          <div className="flex items-center gap-2">
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
            {/* keyed: another sprint gets a fresh form. */}
            <EditSprintButton key={sprint.id} projectId={projectId} sprint={sprint} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sprints yet. Create one to start.</p>
        )}
        <div className="flex items-start gap-2">
          {sprint && (
            <SprintActions
              projectId={projectId}
              sprint={sprint}
              sprints={sprints}
              isOwner={isOwner}
            />
          )}
          <NewSprintButton projectId={projectId} onCreated={select} />
        </div>
      </div>

      {sprint && (
        <>
          {/* keyed: switching sprints starts with a clean summary. */}
          <SprintSummary key={`summary-${sprint.id}`} projectId={projectId} sprintId={sprint.id} />
          <Board key={sprint.id} projectId={projectId} sprintId={sprint.id} />
        </>
      )}
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

interface PopoverProps {
  trigger: ReactNode;
  triggerLabel?: string; // for an icon-only trigger
  title: string;
  // The form inside; `close` closes the popover.
  children: (close: () => void) => ReactNode;
}

// Base UI's popover closes on an outside click or Escape and handles focus.
// The form unmounts on close, so it opens fresh every time.
function SprintPopover({ trigger, triggerLabel, title, children }: PopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={triggerLabel}
        className={cn(
          buttonVariants({ variant: 'outline', size: triggerLabel ? 'icon' : 'default' }),
          'shrink-0',
        )}
      >
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="w-72 text-sm outline-none">
            <Window icon={CalendarPlus} title={title} bar="bg-primary text-primary-foreground">
              <div className="p-4">{children(() => setOpen(false))}</div>
            </Window>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NewSprintButton({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: (sprintId: string) => void;
}) {
  const createSprint = useCreateSprint(projectId);
  return (
    <SprintPopover trigger="New sprint" title="New sprint">
      {(close) => (
        <SprintForm
          defaults={{ name: '', startDate: localDate(), endDate: localDate(13) }}
          submitLabel="Create sprint"
          pending={createSprint.isPending}
          onSubmit={async (input) => {
            const { id } = await createSprint.mutateAsync(input);
            close();
            onCreated(id);
          }}
        />
      )}
    </SprintPopover>
  );
}

function EditSprintButton({ projectId, sprint }: { projectId: string; sprint: Sprint }) {
  const updateSprint = useUpdateSprint(projectId, sprint.id);
  return (
    <SprintPopover trigger={<Pencil />} triggerLabel="Edit sprint" title="Edit sprint">
      {(close) => (
        <SprintForm
          defaults={sprint}
          submitLabel="Save"
          pending={updateSprint.isPending}
          onSubmit={async (input) => {
            await updateSprint.mutateAsync(input);
            close();
          }}
        />
      )}
    </SprintPopover>
  );
}

interface FormProps {
  defaults: CreateSprintInput;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: CreateSprintInput) => Promise<void>;
}

function SprintForm({ defaults, submitLabel, pending, onSubmit }: FormProps) {
  const { errors, formError, onSubmit: submit } = useSchemaForm(createSprintSchema, onSubmit);

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      <FormField
        name="name"
        label="Name"
        placeholder="Sprint 1"
        defaultValue={defaults.name}
        error={errors.name}
      />
      <FormField
        name="startDate"
        label="Start"
        type="date"
        defaultValue={defaults.startDate}
        error={errors.startDate}
      />
      <FormField
        name="endDate"
        label="End"
        type="date"
        defaultValue={defaults.endDate}
        error={errors.endDate}
      />
      <ErrorText>{formError}</ErrorText>
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
