import type { TaskQuery, TaskStatus } from '@ownsprint/shared';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

// Looks up by project too, so a task from another project is "not found".
export function find(projectId: string, taskId: string) {
  return prisma.task.findFirst({ where: { id: taskId, projectId } });
}

export function findWithSubtasks(projectId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, projectId },
    include: { subtasks: { orderBy: { position: 'asc' } } },
  });
}

export async function findPage(projectId: string, query: TaskQuery) {
  const where: Prisma.TaskWhereInput = {
    projectId,
    status: query.status,
    priority: query.priority,
    assigneeId: query.assigneeId,
    sprintId: query.sprintId === 'backlog' ? null : query.sprintId,
    ...(query.q && {
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ],
    }),
  };

  // One transaction, so the page and the total come from the same snapshot.
  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.task.count({ where }),
  ]);
  return { items, total };
}

// Board cards are top-level tasks; subtasks live inside their parent.
// Only the subtasks' status comes along, for the "2/5" progress on the card.
export function findBoard(projectId: string, sprintId: string) {
  return prisma.task.findMany({
    where: { projectId, sprintId, parentId: null },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    include: { subtasks: { select: { status: true } } },
  });
}

export interface Column {
  projectId: string;
  sprintId: string | null;
  status: TaskStatus;
}

// The cards of one column in order, without the card being moved.
export function findColumn(column: Column, exceptId: string) {
  return prisma.task.findMany({
    where: { ...column, parentId: null, id: { not: exceptId } },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true, position: true },
  });
}

// Spreads the cards out again (1000, 2000, …) in one transaction.
export async function renumber(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, i) => prisma.task.update({ where: { id }, data: { position: (i + 1) * 1000 } })),
  );
}

// A board column is "sprint (or backlog) + status". New cards go to its bottom.
export async function nextPosition(projectId: string, sprintId: string | null, status: TaskStatus) {
  const { _max } = await prisma.task.aggregate({
    where: { projectId, sprintId, status },
    _max: { position: true },
  });
  return (_max.position ?? 0) + 1000;
}

export function create(data: Prisma.TaskUncheckedCreateInput) {
  return prisma.task.create({ data });
}

// One INSERT for all rows: either every subtask is saved or none is.
export function createMany(data: Prisma.TaskCreateManyInput[]) {
  return prisma.task.createManyAndReturn({ data });
}

// Swap a task's subtasks for new ones. One transaction: if the insert fails,
// the old subtasks are still there.
export function replaceSubtasks(parentId: string, data: Prisma.TaskCreateManyInput[]) {
  return prisma.$transaction(async (tx) => {
    await tx.task.deleteMany({ where: { parentId } });
    return tx.task.createManyAndReturn({ data });
  });
}

export function update(taskId: string, data: Prisma.TaskUncheckedUpdateInput) {
  return prisma.task.update({ where: { id: taskId }, data });
}

// Subtasks are deleted by the database (ON DELETE CASCADE).
export function remove(taskId: string) {
  return prisma.task.delete({ where: { id: taskId } });
}
