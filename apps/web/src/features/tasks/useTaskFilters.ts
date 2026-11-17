import { useSearchParams } from 'react-router';
import { taskQuerySchema, type TaskQuery } from '@ownsprint/shared';

type Filter = 'q' | 'status' | 'priority' | 'assigneeId' | 'sprintId';
const FILTERS: Filter[] = ['q', 'status', 'priority', 'assigneeId', 'sprintId'];

// The filters and the page live in the URL (?status=done&page=2), so a reload
// or a shared link shows the same list. The other params (?task, ?view) are
// not ours and stay untouched.
export function useTaskFilters() {
  const [params, setParams] = useSearchParams();

  // A hand-edited, invalid URL falls back to the unfiltered first page.
  const parsed = taskQuerySchema.safeParse(Object.fromEntries(params));
  const query: TaskQuery = parsed.success ? parsed.data : taskQuerySchema.parse({});

  // Empty value = "All". Any filter change goes back to page 1.
  const setFilter = (name: Filter, value: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(name, value);
      else next.delete(name);
      next.delete('page');
      return next;
    });

  const setPage = (page: number) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (page > 1) next.set('page', String(page));
      else next.delete('page');
      return next;
    });

  return { query, setFilter, setPage, hasFilters: FILTERS.some((name) => params.has(name)) };
}
