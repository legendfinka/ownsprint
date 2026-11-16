import { createTaskSchema } from '@ownsprint/shared';
import { ErrorText } from '@/components/ErrorText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSchemaForm } from '@/lib/forms';
import { useCreateTask } from './queries';

// Quick add: just a title. The task lands at the bottom of To Do.
export function AddTaskForm({ projectId, sprintId }: { projectId: string; sprintId: string }) {
  const createTask = useCreateTask(projectId, sprintId);
  const { errors, formError, onSubmit } = useSchemaForm(createTaskSchema, async (input, form) => {
    await createTask.mutateAsync(input);
    form.reset();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-1">
      <div className="flex gap-2">
        <Input name="title" placeholder="Add a task" aria-label="New task title" />
        <Button type="submit" variant="outline" disabled={createTask.isPending}>
          Add
        </Button>
      </div>
      <ErrorText>{errors.title ?? formError}</ErrorText>
    </form>
  );
}
