import { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Flag } from 'lucide-react';
import type { Sprint } from '@ownsprint/shared';
import { ErrorText } from '@/components/ErrorText';
import { Select } from '@/components/Select';
import { Window } from '@/components/Window';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/forms';
import { sprintPoints } from './points';
import { useBoard, useCompleteSprint, useStartSprint } from './queries';

interface Props {
  projectId: string;
  sprint: Sprint;
  sprints: Sprint[];
  isOwner: boolean; // only the owner can complete a sprint
}

// Planned → Start. Active → Complete (owner). Completed sprints have no action.
export function SprintActions({ projectId, sprint, sprints, isOwner }: Props) {
  const start = useStartSprint(projectId, sprint.id);
  const { error, reset } = start;

  // The error goes away by itself after 5 seconds.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(reset, 5000);
    return () => clearTimeout(timer);
  }, [error, reset]);

  if (sprint.status === 'planned') {
    return (
      <div className="relative">
        <Button onClick={() => start.mutate()} disabled={start.isPending}>
          Start sprint
        </Button>
        {/* Floats under the button, so the toolbar doesn't jump. */}
        {error && (
          // Visible for 4 s, then fades out over 1 s, just before the reset.
          <div className="absolute top-full right-0 z-10 mt-2 w-max max-w-72 animate-out fade-out fill-mode-forwards duration-1000 [animation-delay:4s]">
            <ErrorText>{error.message}</ErrorText>
          </div>
        )}
      </div>
    );
  }
  if (sprint.status === 'active' && isOwner) {
    return <CompleteSprint projectId={projectId} sprint={sprint} sprints={sprints} />;
  }
  return null;
}

function CompleteSprint({ projectId, sprint, sprints }: Omit<Props, 'isOwner'>) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={<Button variant="outline" />}>Complete sprint</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-1/2 outline-none">
          <Window
            icon={Flag}
            bar="bg-primary text-primary-foreground"
            title={<Dialog.Title render={<span />}>Complete {sprint.name}</Dialog.Title>}
          >
            {/* Unmounts on close, so it opens with a fresh choice every time. */}
            <CompleteForm
              projectId={projectId}
              sprint={sprint}
              sprints={sprints}
              onDone={() => setOpen(false)}
            />
          </Window>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const BACKLOG = 'backlog';

function CompleteForm({
  projectId,
  sprint,
  sprints,
  onDone,
}: Omit<Props, 'isOwner'> & { onDone: () => void }) {
  const { data: tasks } = useBoard(projectId, sprint.id);
  const complete = useCompleteSprint(projectId, sprint.id);
  const [error, setError] = useState<string>();

  // The next planned sprint is the default; the list is sorted by start date.
  const planned = sprints.filter((s) => s.status === 'planned');
  const [choice, setChoice] = useState(planned[0]?.id ?? BACKLOG);

  const points = sprintPoints(tasks ?? []);
  const done = tasks?.filter((t) => t.status === 'done').length ?? 0;
  const open = (tasks?.length ?? 0) - done;

  async function submit() {
    setError(undefined);
    try {
      await complete.mutateAsync({ moveTo: choice === BACKLOG ? null : choice });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="grid gap-4 p-5 text-sm">
      {tasks ? (
        <p className="font-mono">
          {done} of {tasks.length} tasks done · {points.byStatus.done} of {points.total} pts
        </p>
      ) : (
        <p className="text-muted-foreground">Loading…</p>
      )}

      <label className="grid gap-1.5">
        <span>
          Move {open} unfinished {open === 1 ? 'task' : 'tasks'} to
        </span>
        <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
          {planned.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value={BACKLOG}>Backlog</option>
        </Select>
      </label>

      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
        <Button onClick={() => void submit()} disabled={!tasks || complete.isPending}>
          Complete sprint
        </Button>
      </div>
    </div>
  );
}
