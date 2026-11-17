import { Link, useParams, useSearchParams } from 'react-router';
import { ErrorText } from '@/components/ErrorText';
import { SprintBoard } from '@/features/board/SprintBoard';
import { TaskList } from '@/features/tasks/TaskList';
import { cn } from '@/lib/utils';
import { Members } from './Members';
import { useProject } from './queries';

type View = 'board' | 'tasks';
const VIEWS: { view: View; label: string }[] = [
  { view: 'board', label: 'Board' },
  { view: 'tasks', label: 'All tasks' },
];

// Board or task list. The choice lives in the URL (?view=tasks); switching
// starts with clean params, so a filter or sprint doesn't leak into the other view.
function ViewTabs({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <nav aria-label="View" className="flex gap-2">
      {VIEWS.map((v) => (
        <button
          key={v.view}
          type="button"
          aria-current={view === v.view ? 'page' : undefined}
          onClick={() => onChange(v.view)}
          className={cn(
            'rounded-sm border-2 px-3 py-1 text-sm font-semibold hover:border-foreground',
            view === v.view ? 'border-foreground bg-foreground text-background' : 'border-border',
          )}
        >
          {v.label}
        </button>
      ))}
    </nav>
  );
}

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const { data: project, isPending, error } = useProject(projectId);
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'tasks' ? 'tasks' : 'board';
  const setView = (next: View) => setParams(next === 'tasks' ? { view: next } : {});

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

      {/* minmax(0, 1fr): let the board shrink instead of pushing Members off-screen. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-4">
          <ViewTabs view={view} onChange={setView} />
          {view === 'tasks' ? (
            <TaskList projectId={projectId} />
          ) : (
            <SprintBoard projectId={projectId} isOwner={project.role === 'owner'} />
          )}
        </div>

        <Members project={project} />
      </div>
    </div>
  );
}
