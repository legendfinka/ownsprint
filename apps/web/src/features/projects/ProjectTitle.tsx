import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { projectNameSchema, type ProjectDetail } from '@ownsprint/shared';
import { ErrorText } from '@/components/ErrorText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSchemaForm } from '@/lib/forms';
import { useRenameProject } from './queries';

// The project name. The owner can rename it in place.
export function ProjectTitle({ project }: { project: ProjectDetail }) {
  const [editing, setEditing] = useState(false);

  if (editing) return <RenameForm project={project} onDone={() => setEditing(false)} />;

  return (
    <div className="flex items-center gap-3">
      <h1 className="min-w-0 text-4xl font-semibold break-words">{project.name}</h1>
      {project.role === 'owner' && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Rename project"
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
      )}
    </div>
  );
}

function RenameForm({ project, onDone }: { project: ProjectDetail; onDone: () => void }) {
  const rename = useRenameProject(project.id);
  const { errors, formError, onSubmit } = useSchemaForm(projectNameSchema, async (input) => {
    if (input.name !== project.name) await rename.mutateAsync(input);
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-xl gap-2">
      <div className="flex gap-2">
        <Input
          name="name"
          aria-label="Project name"
          defaultValue={project.name}
          autoFocus
          onKeyDown={(e) => e.key === 'Escape' && onDone()}
          className="h-10 text-lg font-semibold"
        />
        <Button type="submit" disabled={rename.isPending} className="h-10">
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onDone} className="h-10">
          Cancel
        </Button>
      </div>
      <ErrorText>{errors.name ?? formError}</ErrorText>
    </form>
  );
}
