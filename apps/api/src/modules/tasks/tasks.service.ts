import type {
  CreateTaskInput,
  Page,
  Task,
  TaskDetail,
  TaskQuery,
  UpdateTaskInput,
} from '@ownsprint/shared';
import type { Task as TaskRow } from '../../generated/prisma/client';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { isMember, requireAccess } from '../projects/projects.service';
import { sprintExists } from '../sprints/sprints.service';
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

  const position = await repo.nextPosition(projectId, input.sprintId, 'todo');
  return toTask(await repo.create({ ...input, projectId, position }));
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
  const moved = sprintId !== task.sprintId || status !== task.status;
  const position = moved ? await repo.nextPosition(projectId, sprintId, status) : undefined;

  return toTask(await repo.update(taskId, { ...input, position }));
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

// Never trust ids from the client: each one must belong to this project.
async function checkReferences(
  projectId: string,
  refs: { assigneeId?: string | null; sprintId?: string | null; parentId?: string | null },
): Promise<void> {
  const errors: Record<string, string> = {};

  if (refs.assigneeId && !(await isMember(projectId, refs.assigneeId))) {
    errors.assigneeId = 'Assignee must be a member of this project';
  }
  if (refs.sprintId && !(await sprintExists(projectId, refs.sprintId))) {
    errors.sprintId = 'Sprint not found in this project';
  }
  if (refs.parentId) {
    const parent = await repo.find(projectId, refs.parentId);
    if (!parent) errors.parentId = 'Parent task not found in this project';
    else if (parent.parentId) errors.parentId = 'Subtasks cannot have their own subtasks';
  }

  if (Object.keys(errors).length > 0) throw ValidationError.fields(errors);
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
