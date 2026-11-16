import { Link } from 'react-router';
import { projectNameSchema } from '@ownsprint/shared';
import { ErrorText } from '@/components/ErrorText';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSchemaForm } from '@/lib/forms';
import { useCreateProject, useProjects } from './queries';

export function ProjectsPage() {
  const { data: projects, isPending, error } = useProjects();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <NewProjectForm />
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading projects…</p>}
      <ErrorText>{error?.message}</ErrorText>
      {projects?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No projects yet. Create your first one above.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <li key={project.id}>
            <Link to={`/projects/${project.id}`}>
              <Card className="transition-colors hover:bg-muted">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription className="capitalize">{project.role}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewProjectForm() {
  const createProject = useCreateProject();
  const { errors, onSubmit } = useSchemaForm(projectNameSchema, async (input, form) => {
    await createProject.mutateAsync(input);
    form.reset();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex items-start gap-2">
      <div className="grid gap-1">
        <Input name="name" placeholder="New project name" aria-label="New project name" />
        <ErrorText>{errors.name ?? createProject.error?.message}</ErrorText>
      </div>
      <Button type="submit" disabled={createProject.isPending}>
        Create
      </Button>
    </form>
  );
}
