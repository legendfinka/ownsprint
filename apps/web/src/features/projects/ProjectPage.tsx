import { Users } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { ErrorText } from '@/components/ErrorText';
import { Window } from '@/components/Window';
import { SprintBoard } from '@/features/board/SprintBoard';
import { useProject } from './queries';

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const { data: project, isPending, error } = useProject(projectId);

  if (isPending) return <p className="font-mono text-sm text-muted-foreground">Loading project…</p>;
  if (error) {
    return (
      <div className="grid gap-2">
        <ErrorText>{error.message}</ErrorText>
        <Link to="/projects" className="text-sm text-primary underline">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-1 border-b-2 border-dashed pb-4">
        <Link to="/projects" className="w-fit font-mono text-xs text-primary hover:underline">
          ← all projects
        </Link>
        <h1 className="text-4xl font-semibold">{project.name}</h1>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_260px]">
        <SprintBoard projectId={projectId} />

        <Window icon={Users} title={`Members (${project.members.length})`}>
          <ul className="grid gap-3 p-4">
            {project.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 text-sm">
                <Avatar name={member.name} />
                <span className="grid min-w-0">
                  <span className="truncate font-medium">{member.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                </span>
                {member.role === 'owner' && (
                  <span className="ml-auto border px-1.5 font-mono text-[11px] tracking-wider uppercase">
                    Owner
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Window>
      </div>
    </div>
  );
}
