import { useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import {
  prioritySchema,
  type BreakdownSuggestion,
  type TaskDetail,
  type UpdateTaskInput,
} from '@ownsprint/shared';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorText } from '@/components/ErrorText';
import { Select } from '@/components/Select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PriorityMark, PriorityOptions, PriorityStamp } from '@/features/tasks/PriorityStamp';
import { useCreateSubtasks, useUpdateTask } from '@/features/tasks/queries';
import { errorMessage } from '@/lib/forms';
import { useBreakdown, useDescription, useEstimate } from './queries';

// AI suggestions for one task. Nothing is saved until the user says so.
export function AiAssistant({ projectId, task }: { projectId: string; task: TaskDetail }) {
  return (
    <section className="grid gap-3 rounded-sm border-2 border-dashed p-3">
      <h3 className="flex items-center gap-2 font-heading font-semibold">
        <Sparkles className="size-4 text-primary" aria-hidden />
        AI assistant
        <span className="ml-auto font-mono text-[11px] font-normal text-muted-foreground uppercase">
          suggestions only
        </span>
      </h3>
      <DescriptionSuggestion projectId={projectId} taskId={task.id} />
      <EstimateSuggestion projectId={projectId} taskId={task.id} />
      {!task.parentId && <BreakdownSuggestions projectId={projectId} task={task} />}
    </section>
  );
}

// The button that asks the AI, with its "Thinking…" state and error.
function AskButton(props: { label: string; ask: () => void; pending: boolean; error: unknown }) {
  return (
    <div className="grid gap-1">
      <Button variant="outline" className="w-fit" onClick={props.ask} disabled={props.pending}>
        {props.pending ? 'Thinking…' : props.label}
      </Button>
      <ErrorText>{props.error ? errorMessage(props.error) : null}</ErrorText>
    </div>
  );
}

// A suggestion with Apply / Dismiss: applying saves it to the task.
function ApplyCard(props: {
  projectId: string;
  taskId: string;
  changes: UpdateTaskInput;
  onDone: () => void;
  children: ReactNode;
}) {
  const update = useUpdateTask(props.projectId);
  const apply = () =>
    update.mutate({ taskId: props.taskId, ...props.changes }, { onSuccess: props.onDone });

  return (
    <div className="grid gap-2 rounded-sm border-2 bg-card p-3 text-sm">
      {props.children}
      <ErrorText>{update.error && errorMessage(update.error)}</ErrorText>
      <div className="flex gap-2">
        <Button size="sm" onClick={apply} disabled={update.isPending}>
          Apply
        </Button>
        <Button size="sm" variant="ghost" onClick={props.onDone}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function DescriptionSuggestion({ projectId, taskId }: { projectId: string; taskId: string }) {
  const suggest = useDescription(projectId, taskId);

  if (!suggest.data) {
    return (
      <AskButton
        label="Write description"
        ask={() => suggest.mutate()}
        pending={suggest.isPending}
        error={suggest.error}
      />
    );
  }
  return (
    <ApplyCard
      projectId={projectId}
      taskId={taskId}
      changes={{ description: suggest.data.description }}
      onDone={() => suggest.reset()}
    >
      <p className="whitespace-pre-wrap">{suggest.data.description}</p>
    </ApplyCard>
  );
}

function EstimateSuggestion({ projectId, taskId }: { projectId: string; taskId: string }) {
  const suggest = useEstimate(projectId, taskId);

  if (!suggest.data) {
    return (
      <AskButton
        label="Suggest estimate"
        ask={() => suggest.mutate()}
        pending={suggest.isPending}
        error={suggest.error}
      />
    );
  }
  const { estimate, priority, rationale } = suggest.data;
  return (
    <ApplyCard
      projectId={projectId}
      taskId={taskId}
      changes={{ estimate, priority }}
      onDone={() => suggest.reset()}
    >
      <p className="flex items-center gap-2">
        <span className="font-mono font-bold">{estimate} pts</span>
        <PriorityStamp priority={priority} />
      </p>
      <p className="text-muted-foreground">{rationale}</p>
    </ApplyCard>
  );
}

// A suggested subtask while the user reviews it.
type Draft = BreakdownSuggestion['subtasks'][number] & { keep: boolean };

function BreakdownSuggestions({ projectId, task }: { projectId: string; task: TaskDetail }) {
  const breakdown = useBreakdown(projectId, task.id);
  const save = useCreateSubtasks(projectId, task.id);
  // The review list is local UI state: edits here are not server data until saved.
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  if (!drafts) {
    return (
      <AskButton
        label="Break down into subtasks"
        pending={breakdown.isPending}
        error={breakdown.error}
        ask={() =>
          breakdown.mutate(undefined, {
            onSuccess: ({ subtasks }) => setDrafts(subtasks.map((s) => ({ ...s, keep: true }))),
          })
        }
      />
    );
  }

  const edit = (index: number, change: Partial<Draft>) =>
    setDrafts(drafts.map((draft, i) => (i === index ? { ...draft, ...change } : draft)));
  const kept = drafts.filter((d) => d.keep);
  const canSave = kept.length > 0 && kept.every((d) => d.title.trim());

  // The new list replaces the current subtasks (the AI saw them and kept what's useful).
  const input = {
    subtasks: kept.map(({ title, priority, estimate }) => ({
      title: title.trim(),
      priority,
      estimate,
    })),
    replace: true,
  };
  const close = () => setDrafts(null);

  const existing = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.status === 'done').length;
  const count = (n: number) => `${String(n)} subtask${n === 1 ? '' : 's'}`;

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        Review the suggestions: untick, edit or reprioritize any.
      </p>
      <ul className="grid gap-1.5">
        {drafts.map((draft, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={`Keep suggestion ${String(i + 1)}`}
              checked={draft.keep}
              onChange={(e) => edit(i, { keep: e.target.checked })}
              className="size-4 accent-primary"
            />
            <Input
              aria-label={`Suggestion ${String(i + 1)} title`}
              value={draft.title}
              onChange={(e) => edit(i, { title: e.target.value })}
              disabled={!draft.keep}
            />
            <Select
              aria-label={`Suggestion ${String(i + 1)} priority`}
              value={draft.priority}
              icon={<PriorityMark priority={draft.priority} colored />}
              onChange={(e) => edit(i, { priority: prioritySchema.parse(e.target.value) })}
              disabled={!draft.keep}
              className="w-28 shrink-0"
            >
              <PriorityOptions />
            </Select>
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-muted-foreground uppercase">
              {draft.estimate} pts
            </span>
          </li>
        ))}
      </ul>
      <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
      <div className="flex gap-2">
        {existing === 0 ? (
          <Button
            size="sm"
            onClick={() => save.mutate(input, { onSuccess: close })}
            disabled={!canSave || save.isPending}
          >
            Add {count(kept.length)}
          </Button>
        ) : (
          // Replacing deletes the current subtasks, so ask first.
          <ConfirmDialog
            trigger="Replace subtasks"
            title="Replace subtasks?"
            description={
              <>
                This deletes the {count(existing)} this task has now
                {done > 0 && <strong> ({String(done)} already done)</strong>} and adds{' '}
                {count(kept.length)}. This can’t be undone.
              </>
            }
            confirmLabel="Replace"
            disabled={!canSave}
            // The confirm window shows the error if saving fails.
            onConfirm={() => save.mutateAsync(input).then(close)}
          />
        )}
        <Button size="sm" variant="ghost" onClick={close}>
          Discard
        </Button>
      </div>
    </div>
  );
}
