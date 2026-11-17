import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Sparkles, X } from 'lucide-react';
import { STORY_POINTS, type BoardTask, type SprintEstimates } from '@ownsprint/shared';
import { ErrorText } from '@/components/ErrorText';
import { Select } from '@/components/Select';
import { Window } from '@/components/Window';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { useApplyEstimates, useSuggestEstimates } from './queries';

interface Props {
  projectId: string;
  sprintId: string;
  tasks: BoardTask[]; // to show each suggestion next to its task's title
}

// "Estimate with AI": the AI sizes every task that has no estimate in one go.
// The answer is shown in a window to review; nothing is saved until "Apply".
export function BulkEstimate({ projectId, sprintId, tasks }: Props) {
  const [open, setOpen] = useState(false);
  const suggest = useSuggestEstimates(projectId, sprintId);

  function ask() {
    setOpen(true);
    suggest.mutate();
  }
  function close() {
    setOpen(false);
    suggest.reset(); // drops the old answer, so the next time starts clean
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Button size="sm" variant="outline" onClick={ask}>
        <Sparkles className="size-3.5" aria-hidden />
        Estimate with AI
      </Button>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(36rem,calc(100vw-2rem))] -translate-1/2 overflow-y-auto outline-none">
          <Window
            icon={Sparkles}
            bar="bg-primary text-primary-foreground"
            title={
              <>
                <Dialog.Title render={<span />}>Suggested estimates</Dialog.Title>
                <Dialog.Close aria-label="Close" className="ml-auto rounded-sm hover:opacity-70">
                  <X className="size-4" strokeWidth={2.5} />
                </Dialog.Close>
              </>
            }
          >
            {suggest.isPending && (
              <p className="p-5 font-mono text-sm text-muted-foreground">Asking the AI…</p>
            )}
            {suggest.error && (
              <div className="grid gap-3 p-5">
                <ErrorText>{errorMessage(suggest.error)}</ErrorText>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => suggest.mutate()}>
                    Try again
                  </Button>
                  <Button size="sm" variant="ghost" onClick={close}>
                    Close
                  </Button>
                </div>
              </div>
            )}
            {suggest.data && (
              <Review
                projectId={projectId}
                result={suggest.data}
                titles={new Map(tasks.map((t) => [t.id, t.title]))}
                onClose={close}
              />
            )}
          </Window>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// A suggestion while the user reviews it.
type Draft = SprintEstimates['suggestions'][number] & { keep: boolean };

interface ReviewProps {
  projectId: string;
  result: SprintEstimates;
  titles: Map<string, string>;
  onClose: () => void;
}

function Review({ projectId, result, titles, onClose }: ReviewProps) {
  // Local UI state: edits here are not server data until applied.
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    result.suggestions.map((s) => ({ ...s, keep: true })),
  );
  const apply = useApplyEstimates(projectId);

  const edit = (index: number, change: Partial<Draft>) =>
    setDrafts(drafts.map((draft, i) => (i === index ? { ...draft, ...change } : draft)));
  const kept = drafts.filter((d) => d.keep);

  return (
    <div className="grid gap-4 p-5">
      <p className="text-sm text-muted-foreground">
        Review the suggestions: untick or change any. Nothing is saved until you apply.
      </p>
      <ul className="grid gap-2.5">
        {drafts.map((draft, i) => {
          const title = titles.get(draft.taskId) ?? 'Task';
          return (
            <li key={draft.taskId} className="grid gap-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Apply to ${title}`}
                  checked={draft.keep}
                  onChange={(e) => edit(i, { keep: e.target.checked })}
                  className="size-4 shrink-0 accent-primary"
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm font-medium',
                    !draft.keep && 'text-muted-foreground',
                  )}
                >
                  {title}
                </span>
                <Select
                  aria-label={`Points for ${title}`}
                  value={draft.estimate}
                  onChange={(e) => {
                    const points = STORY_POINTS.find((p) => String(p) === e.target.value);
                    if (points) edit(i, { estimate: points });
                  }}
                  disabled={!draft.keep}
                  className="w-20 shrink-0"
                >
                  {STORY_POINTS.map((p) => (
                    <option key={p} value={p}>
                      {p} pts
                    </option>
                  ))}
                </Select>
              </div>
              {draft.rationale && (
                <p className="pl-6 text-xs text-muted-foreground">{draft.rationale}</p>
              )}
            </li>
          );
        })}
      </ul>
      {result.remaining > 0 && (
        <p className="font-mono text-xs text-muted-foreground">
          {result.remaining} more {result.remaining === 1 ? 'task has' : 'tasks have'} no estimate.
          Apply these, then run it again.
        </p>
      )}
      <ErrorText>{apply.error && errorMessage(apply.error)}</ErrorText>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={kept.length === 0 || apply.isPending}
          onClick={() =>
            apply.mutate(
              kept.map(({ taskId, estimate }) => ({ taskId, estimate })),
              { onSuccess: onClose },
            )
          }
        >
          Apply {kept.length} {kept.length === 1 ? 'estimate' : 'estimates'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Discard
        </Button>
      </div>
    </div>
  );
}
