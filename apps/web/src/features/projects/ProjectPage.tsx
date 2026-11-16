import { Link, useParams } from 'react-router';
import { ErrorText } from '@/components/ErrorText';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProject } from './queries';

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const { data: project, isPending, error } = useProject(projectId);

  if (isPending) return <p className="text-sm text-muted-foreground">Loading project…</p>;
  if (error) {
    return (
      <div className="grid gap-2">
        <ErrorText>{error.message}</ErrorText>
        <Link to="/projects" className="text-sm underline">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <Link to="/projects" className="text-sm text-muted-foreground hover:underline">
          ← Projects
        </Link>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            The sprint board will appear here.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {project.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {member.name}
                    <span className="block text-muted-foreground">{member.email}</span>
                  </span>
                  <span className="text-muted-foreground capitalize">{member.role}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
