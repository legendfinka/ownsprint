import { Link } from 'react-router';
import { projectNameSchema } from '@ownsprint/shared';
import { Avatar } from '@/components/Avatar';
import { ErrorText } from '@/components/ErrorText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSchemaForm } from '@/lib/forms';
import { useCreateProject, useProjects } from './queries';

export function ProjectsPage() {
  const { data: projects, isPending, error } = useProjects();

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-dashed pb-4">
        <div>
          <h1 className="text-4xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Pick a project to open its sprint board.</p>
        </div>
        <NewProjectForm />
      </div>

      {isPending && <p className="font-mono text-sm text-muted-foreground">Loading projects…</p>}
      <ErrorText persistent>{error?.message}</ErrorText>
      {projects?.length === 0 && (
        <div className="grid place-items-center gap-1 rounded-sm border-2 border-dashed py-16 text-center">
          <p className="font-heading text-lg font-bold">Nothing here yet.</p>
          <p className="text-sm text-muted-foreground">Create your first project above.</p>
        </div>
      )}

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <li key={project.id}>
            <Link
              to={`/projects/${project.id}`}
              className="group flex items-center gap-4 rounded-sm border-2 bg-card p-4 shadow-hard transition-transform hover:-translate-0.5 active:translate-0.5 active:shadow-none"
            >
              <Avatar name={project.name} className="size-11 text-sm" />
              <span className="grid min-w-0 gap-1">
                <span className="truncate font-heading text-lg font-semibold text-primary group-hover:underline">
                  {project.name}
                </span>
                <span className="w-fit border px-1.5 font-mono text-[11px] tracking-wider uppercase">
                  {project.role}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewProjectForm() {
  const createProject = useCreateProject();
  const { errors, formError, onSubmit } = useSchemaForm(projectNameSchema, async (input, form) => {
    await createProject.mutateAsync(input);
    form.reset();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex items-start gap-2">
      {/* Fixed width: a long error wraps instead of stretching the field. */}
      <div className="grid w-64 max-w-full gap-1">
        <Input name="name" placeholder="New project name" aria-label="New project name" />
        <ErrorText>{errors.name ?? formError}</ErrorText>
      </div>
      <Button type="submit" disabled={createProject.isPending}>
        Create
      </Button>
    </form>
  );
}
