import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { FileText, X } from 'lucide-react';
import {
  createTaskSchema,
  prioritySchema,
  taskStatusSchema,
  type TaskDetail,
  type UpdateTaskInput,
} from '@ownsprint/shared';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorText } from '@/components/ErrorText';
import { Select } from '@/components/Select';
import { Window } from '@/components/Window';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AiAssistant } from '@/features/ai/AiAssistant';
import { COLUMNS } from '@/features/board/reorder';
import { useProject } from '@/features/projects/queries';
import { errorMessage, useSchemaForm } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { PriorityMark, PriorityOptions, PriorityStamp } from './PriorityStamp';
import { useCreateSubtask, useDeleteTask, useTask, useTaskParam, useUpdateTask } from './queries';

// The task from ?task=… in a dialog. Esc, the X or a click outside closes it.
export function TaskDialog({ projectId }: { projectId: string }) {
  const [taskId, openTask] = useTaskParam();

  return (
    <Dialog.Root open={taskId !== null} onOpenChange={(open) => !open && openTask(null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(40rem,calc(100vw-2rem))] -translate-1/2 overflow-y-auto outline-none">
          {taskId && <TaskDetails projectId={projectId} taskId={taskId} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TaskDetails({ projectId, taskId }: { projectId: string; taskId: string }) {
  const { data: task, isPending, error } = useTask(projectId, taskId);

  const title = (
    <>
      <Dialog.Title render={<span />}>{task?.parentId ? 'Subtask' : 'Task'}</Dialog.Title>
      <Dialog.Close aria-label="Close" className="ml-auto rounded-sm hover:opacity-70">
        <X className="size-4" strokeWidth={2.5} />
      </Dialog.Close>
    </>
  );

  return (
    <Window icon={FileText} title={title}>
      {isPending && <p className="p-5 font-mono text-sm text-muted-foreground">Loading…</p>}
      {error && <ErrorText>{error.message}</ErrorText>}
      {/* key: switching to another task resets the uncontrolled fields. */}
      {task && <TaskFields key={task.id} projectId={projectId} task={task} />}
    </Window>
  );
}

// Each field saves on its own (on change or when leaving it), like in Jira:
// no "Save" button to forget, and the server validates every change.
function TaskFields({ projectId, task }: { projectId: string; task: TaskDetail }) {
  const [, openTask] = useTaskParam();
  const members = useProject(projectId).data?.members ?? [];
  const update = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const save = (input: UpdateTaskInput) => update.mutate({ taskId: task.id, ...input });

  const kind = task.parentId ? 'subtask' : 'task';
  const subtaskCount = task.subtasks.length;

  async function onDelete() {
    await deleteTask.mutateAsync(task.id);
    // A deleted subtask goes back to its parent; a deleted task closes the dialog.
    openTask(task.parentId);
  }

  return (
    <div className="grid gap-5 p-5">
      {task.parentId && (
        <button
          type="button"
          onClick={() => openTask(task.parentId)}
          className="w-fit font-mono text-xs text-primary hover:underline"
        >
          ← parent task
        </button>
      )}

      {/* Fields are uncontrolled, so each is keyed by its saved value: when it
          changes elsewhere (AI "Apply", a board move), the field shows it. */}
      <input
        key={task.title}
        aria-label="Title"
        defaultValue={task.title}
        onBlur={(e) => {
          const title = e.target.value.trim();
          if (title && title !== task.title) save({ title });
        }}
        className="w-full bg-transparent font-heading text-2xl font-semibold outline-none focus-visible:underline focus-visible:decoration-dotted"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Status">
          <Select
            key={task.status}
            defaultValue={task.status}
            onChange={(e) => save({ status: taskStatusSchema.parse(e.target.value) })}
          >
            {COLUMNS.map(({ status, title }) => (
              <option key={status} value={status}>
                {title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            key={task.priority}
            icon={<PriorityMark priority={task.priority} colored />}
            defaultValue={task.priority}
            onChange={(e) => save({ priority: prioritySchema.parse(e.target.value) })}
          >
            <PriorityOptions />
          </Select>
        </Field>
        <Field label="Estimate (pts)">
          <Input
            key={task.estimate}
            type="number"
            min={0}
            max={100}
            placeholder="—"
            defaultValue={task.estimate ?? ''}
            onBlur={(e) => {
              const estimate = e.target.value === '' ? null : Number(e.target.value);
              if (estimate !== task.estimate) save({ estimate });
            }}
          />
        </Field>
        <Field label="Assignee">
          <Select
            key={task.assigneeId}
            defaultValue={task.assigneeId ?? ''}
            onChange={(e) => save({ assigneeId: e.target.value || null })}
          >
            <option value="">Nobody</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          key={task.description}
          rows={4}
          defaultValue={task.description}
          placeholder="Add some details…"
          onBlur={(e) => {
            if (e.target.value !== task.description) save({ description: e.target.value });
          }}
          className="w-full rounded-sm border-2 bg-card p-2.5 text-sm font-normal outline-none focus-visible:border-primary"
        />
      </Field>

      <ErrorText>{update.error && errorMessage(update.error)}</ErrorText>

      <AiAssistant projectId={projectId} task={task} />

      {!task.parentId && <Subtasks projectId={projectId} task={task} />}

      <div className="flex justify-end border-t-2 border-dashed pt-4">
        <ConfirmDialog
          trigger={`Delete ${kind}`}
          title={`Delete ${kind}?`}
          description={
            <>
              <strong>“{task.title}”</strong> will be deleted
              {subtaskCount > 0 &&
                ` together with its ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}`}
              . This can’t be undone.
            </>
          }
          confirmLabel={`Delete ${kind}`}
          onConfirm={onDelete}
        />
      </div>
    </div>
  );
}

function Subtasks({ projectId, task }: { projectId: string; task: TaskDetail }) {
  const [, openTask] = useTaskParam();
  const update = useUpdateTask(projectId);
  const createSubtask = useCreateSubtask(projectId, task);
  const { errors, formError, onSubmit } = useSchemaForm(createTaskSchema, async (input, form) => {
    await createSubtask.mutateAsync(input);
    form.reset();
  });
  const done = task.subtasks.filter((s) => s.status === 'done').length;

  return (
    <section className="grid gap-2">
      <h3 className="flex items-baseline font-heading font-semibold">
        Subtasks
        <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
          {done}/{task.subtasks.length} done
        </span>
      </h3>
      <ul className="grid gap-1.5">
        {task.subtasks.map((subtask) => (
          <li
            key={subtask.id}
            className="flex items-center gap-2 rounded-sm border-2 bg-card px-2 py-1.5 text-sm"
          >
            <input
              type="checkbox"
              aria-label={`Done: ${subtask.title}`}
              defaultChecked={subtask.status === 'done'}
              onChange={(e) =>
                update.mutate({ taskId: subtask.id, status: e.target.checked ? 'done' : 'todo' })
              }
              className="size-4 accent-primary"
            />
            <button
              type="button"
              onClick={() => openTask(subtask.id)}
              className={cn(
                'min-w-0 flex-1 truncate text-left hover:underline',
                subtask.status === 'done' && 'text-muted-foreground line-through',
              )}
            >
              {subtask.title}
            </button>
            <PriorityStamp priority={subtask.priority} />
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} noValidate className="grid gap-1">
        <div className="flex gap-2">
          <Input name="title" placeholder="Add a subtask" aria-label="New subtask title" />
          <Button type="submit" variant="outline" disabled={createSubtask.isPending}>
            Add
          </Button>
        </div>
        <ErrorText>
          {errors.title ?? formError ?? (update.error && errorMessage(update.error))}
        </ErrorText>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid content-start gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
