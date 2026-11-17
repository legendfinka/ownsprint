import type {
  BoardResponse,
  CreateSubtasksInput,
  CreateTaskInput,
  MoveTaskInput,
  Page,
  Task,
  TaskDetail,
  TaskQuery,
  UpdateTaskInput,
} from '@ownsprint/shared';
import type { Task as TaskRow } from '../../generated/prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import { isMember, requireAccess } from '../projects/projects.service';
import { sprintStatus } from '../sprints/sprints.service';
import * as repo from './tasks.repository';

export async function listTasks(
  userId: string,
  projectId: string,
  query: TaskQuery,
): Promise<Page<Task>> {
  await requireAccess(userId, projectId);
  const { items, total } = await repo.findPage(projectId, query);
  return { items: items.map(toTask), total, page: query.page, pageSize: query.pageSize };
}

export async function getTask(
  userId: string,
  projectId: string,
  taskId: string,
): Promise<TaskDetail> {
  await requireAccess(userId, projectId);
  const task = await repo.findWithSubtasks(projectId, taskId);
  if (!task) throw new NotFoundError('Task not found');
  return { ...toTask(task), subtasks: task.subtasks.map(toTask) };
}

export async function createTask(
  userId: string,
  projectId: string,
  input: CreateTaskInput,
): Promise<Task> {
  await requireAccess(userId, projectId);
  await checkReferences(projectId, input);
  await requireOpenSprint(projectId, input.sprintId ?? null);

  const position = await repo.nextPosition(projectId, input.sprintId, 'todo');
  return toTask(await repo.create({ ...input, projectId, position }));
}

// Several subtasks at once, e.g. an AI breakdown the user confirmed.
// With `replace`, they take the place of the current subtasks.
export async function createSubtasks(
  userId: string,
  projectId: string,
  taskId: string,
  input: CreateSubtasksInput,
): Promise<Task[]> {
  await requireAccess(userId, projectId);
  const parent = await getOwnTask(projectId, taskId);
  if (parent.parentId) {
    throw ValidationError.fields({ taskId: 'Subtasks cannot have their own subtasks' });
  }

  await requireOpenSprint(projectId, parent.sprintId);

  // Same sprint as the parent, in order, at the bottom of To Do.
  const first = await repo.nextPosition(projectId, parent.sprintId, 'todo');
  const rows = input.subtasks.map((subtask, i) => ({
    ...subtask,
    projectId,
    parentId: parent.id,
    sprintId: parent.sprintId,
    position: first + i * 1000,
  }));

  const saved = input.replace
    ? await repo.replaceSubtasks(parent.id, rows)
    : await repo.createMany(rows);
  return saved.map(toTask);
}

export async function updateTask(
  userId: string,
  projectId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<Task> {
  await requireAccess(userId, projectId);
  const task = await getOwnTask(projectId, taskId);
  await checkReferences(projectId, input);

  // A new sprint or status means a new board column: put the task at its bottom.
  const sprintId = input.sprintId === undefined ? task.sprintId : input.sprintId;
  const status = input.status ?? task.status;
  if (sprintId !== task.sprintId) await requireOpenSprint(projectId, sprintId);
  const moved = sprintId !== task.sprintId || status !== task.status;
  const position = moved ? await repo.nextPosition(projectId, sprintId, status) : undefined;

  return toTask(await repo.update(taskId, { ...input, position }));
}

export async function getBoard(
  userId: string,
  projectId: string,
  sprintId: string,
): Promise<BoardResponse> {
  await requireAccess(userId, projectId);
  if (!(await sprintStatus(projectId, sprintId))) throw new NotFoundError('Sprint not found');

  const tasks = await repo.findBoard(projectId, sprintId);
  return {
    tasks: tasks.map(({ subtasks, ...task }) => ({
      ...toTask(task),
      subtaskCount: {
        done: subtasks.filter((s) => s.status === 'done').length,
        total: subtasks.length,
      },
    })),
  };
}

// Drag-and-drop: puts the card into `status`, right below `afterId`.
export async function moveTask(
  userId: string,
  projectId: string,
  taskId: string,
  input: MoveTaskInput,
): Promise<Task> {
  await requireAccess(userId, projectId);
  const task = await getOwnTask(projectId, taskId);
  if (task.parentId) throw ValidationError.fields({ taskId: 'Subtasks are not on the board' });
  await requireOpenSprint(projectId, task.sprintId);

  const column = { projectId, sprintId: task.sprintId, status: input.status };
  const position = await positionBelow(column, taskId, input.afterId);
  return toTask(await repo.update(taskId, { status: input.status, position }));
}

export async function deleteTask(userId: string, projectId: string, taskId: string): Promise<void> {
  await requireAccess(userId, projectId);
  await getOwnTask(projectId, taskId);
  await repo.remove(taskId);
}

async function getOwnTask(projectId: string, taskId: string): Promise<TaskRow> {
  const task = await repo.find(projectId, taskId);
  if (!task) throw new NotFoundError('Task not found');
  return task;
}

// A completed sprint is closed: nothing is added, moved or dragged in it.
async function requireOpenSprint(projectId: string, sprintId: string | null): Promise<void> {
  if (sprintId && (await sprintStatus(projectId, sprintId)) === 'completed') {
    throw new ConflictError('This sprint is completed');
  }
}

// Never trust ids from the client: each one must belong to this project.
async function checkReferences(
  projectId: string,
  refs: { assigneeId?: string | null; sprintId?: string | null; parentId?: string | null },
): Promise<void> {
  // The three lookups don't depend on each other, so run them in parallel.
  const [assigneeOk, sprintOk, parent] = await Promise.all([
    !refs.assigneeId || isMember(projectId, refs.assigneeId),
    !refs.sprintId || sprintStatus(projectId, refs.sprintId),
    refs.parentId ? repo.find(projectId, refs.parentId) : undefined,
  ]);

  const errors: Record<string, string> = {};
  if (!assigneeOk) errors.assigneeId = 'Assignee must be a member of this project';
  if (!sprintOk) errors.sprintId = 'Sprint not found in this project';
  if (parent === null) errors.parentId = 'Parent task not found in this project';
  else if (parent?.parentId) errors.parentId = 'Subtasks cannot have their own subtasks';

  if (Object.keys(errors).length > 0) throw ValidationError.fields(errors);
}

const GAP = 1000;
const MIN_GAP = 1e-6; // far above float precision, so midpoints stay distinct

// A position between the card above and the card below the drop spot, so
// only the moved card changes. When the gap gets too small (after many
// drops in the same spot), the column is renumbered first.
async function positionBelow(
  column: repo.Column,
  taskId: string,
  afterId: string | null,
): Promise<number> {
  const cards = await repo.findColumn(column, taskId);
  const index = afterId === null ? 0 : cards.findIndex((card) => card.id === afterId) + 1;
  if (afterId !== null && index === 0) {
    throw ValidationError.fields({ afterId: 'Must be a card in the target column' });
  }

  const above = cards[index - 1];
  const below = cards[index];
  if (above && below) {
    if (below.position - above.position >= MIN_GAP) return (above.position + below.position) / 2;
    await repo.renumber(cards.map((card) => card.id));
    return (index + 0.5) * GAP; // halfway between the renumbered neighbours
  }
  if (above) return above.position + GAP;
  if (below) return below.position - GAP;
  return GAP;
}

function toTask(task: TaskRow): Task {
  return {
    id: task.id,
    projectId: task.projectId,
    sprintId: task.sprintId,
    parentId: task.parentId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    estimate: task.estimate,
    assigneeId: task.assigneeId,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
