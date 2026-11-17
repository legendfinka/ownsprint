import { useEffect, useState } from 'react';
import { ListFilter, Search, X } from 'lucide-react';
import { ErrorText } from '@/components/ErrorText';
import { Select } from '@/components/Select';
import { Window } from '@/components/Window';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSprints } from '@/features/board/queries';
import { COLUMNS } from '@/features/board/reorder';
import { useProject } from '@/features/projects/queries';
import { PriorityOptions, PriorityStamp } from './PriorityStamp';
import { useTaskParam, useTasks } from './queries';
import { TaskDialog } from './TaskDialog';
import { useTaskFilters } from './useTaskFilters';

const statusTitle = Object.fromEntries(COLUMNS.map((c) => [c.status, c.title]));

// All tasks of the project, across sprints and the backlog, with search and
// filters. Filtering and paging happen on the server.
export function TaskList({ projectId }: { projectId: string }) {
  const { query, setFilter, setPage, hasFilters } = useTaskFilters();
  const { data, isPending, error } = useTasks(projectId, query);
  const members = useProject(projectId).data?.members ?? [];
  const sprints = useSprints(projectId).data ?? [];
  const [, openTask] = useTaskParam();

  // Typing waits for a pause before it searches, so there is one request per word.
  const [text, setText] = useState(query.q ?? '');
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.trim() !== (query.q ?? '')) setFilter('q', text.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [text, query.q, setFilter]);

  const assignee = (id: string | null) => members.find((m) => m.id === id)?.name ?? '—';
  const sprintName = (id: string | null) =>
    id ? (sprints.find((s) => s.id === id)?.name ?? '—') : 'Backlog';

  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const first = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? first + data.items.length - 1 : 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full shrink-0">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search tasks"
            placeholder="Search title or description"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="px-8"
          />
          {text && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setText('')}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Select
          aria-label="Status"
          value={query.status ?? ''}
          onChange={(e) => setFilter('status', e.target.value)}
          className="w-36"
        >
          <option value="">All statuses</option>
          {COLUMNS.map((c) => (
            <option key={c.status} value={c.status}>
              {c.title}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Priority"
          value={query.priority ?? ''}
          onChange={(e) => setFilter('priority', e.target.value)}
          className="w-36"
        >
          <option value="">All priorities</option>
          <PriorityOptions />
        </Select>
        <Select
          aria-label="Assignee"
          value={query.assigneeId ?? ''}
          onChange={(e) => setFilter('assigneeId', e.target.value)}
          className="w-40"
        >
          <option value="">Anyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sprint"
          value={query.sprintId ?? ''}
          onChange={(e) => setFilter('sprintId', e.target.value)}
          className="w-40"
        >
          <option value="">All sprints</option>
          <option value="backlog">Backlog</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <Window icon={ListFilter} title={data ? `Tasks (${data.total})` : 'Tasks'}>
        {isPending ? (
          <p className="p-5 text-sm text-muted-foreground">Loading tasks…</p>
        ) : error ? (
          <div className="p-5">
            <ErrorText persistent>{error.message}</ErrorText>
          </div>
        ) : data.items.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            {hasFilters ? 'No tasks match these filters.' : 'No tasks yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            {/* Fixed layout: the columns keep their width, the task title takes the
                rest and is cut with "…" (the full title is in the tooltip). */}
            <table className="w-full min-w-176 table-fixed text-left text-sm">
              <colgroup>
                <col />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-36" />
                <col className="w-32" />
                <col className="w-16" />
              </colgroup>
              <thead className="border-b-2 border-dashed font-mono text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Task</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Priority</th>
                  <th className="px-2 py-2 font-medium">Assignee</th>
                  <th className="px-2 py-2 font-medium">Sprint</th>
                  <th className="px-4 py-2 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((task) => (
                  <tr key={task.id} className="border-b border-dashed last:border-b-0">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title={task.title}
                          onClick={() => openTask(task.id)}
                          className="min-w-0 truncate text-left font-medium hover:underline"
                        >
                          {task.title}
                        </button>
                        {task.parentId && (
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            subtask
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="truncate px-2 py-2">{statusTitle[task.status]}</td>
                    <td className="px-2 py-2">
                      <PriorityStamp priority={task.priority} />
                    </td>
                    <td className="truncate px-2 py-2">{assignee(task.assigneeId)}</td>
                    <td className="truncate px-2 py-2">{sprintName(task.sprintId)}</td>
                    <td className="px-4 py-2 text-right font-mono">{task.estimate ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Window>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span>
            {first}–{last} of {data.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage(data.page - 1)}
            >
              Previous
            </Button>
            <span>
              {data.page} / {lastPage}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= lastPage}
              onClick={() => setPage(data.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      <TaskDialog projectId={projectId} />
    </div>
  );
}
