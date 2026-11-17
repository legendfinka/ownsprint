import type { TaskStatus } from '@ownsprint/shared';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

export function list(projectId: string) {
  return prisma.sprint.findMany({ where: { projectId }, orderBy: { startDate: 'asc' } });
}

// Looks up by project too, so a sprint from another project is "not found".
export function find(projectId: string, sprintId: string) {
  return prisma.sprint.findFirst({ where: { id: sprintId, projectId } });
}

export function findOtherActive(projectId: string, sprintId: string) {
  return prisma.sprint.findFirst({
    where: { projectId, status: 'active', NOT: { id: sprintId } },
  });
}

export function create(data: Prisma.SprintUncheckedCreateInput) {
  return prisma.sprint.create({ data });
}

export function update(sprintId: string, data: Prisma.SprintUncheckedUpdateInput) {
  return prisma.sprint.update({ where: { id: sprintId }, data });
}

// Completes an active sprint and moves its unfinished tasks (with their
// subtasks) to `moveTo`, a sprint or the backlog (null). One transaction.
// Returns false if the sprint was not active. The status check is part of the
// UPDATE, so of two simultaneous calls only one wins.
export function complete(projectId: string, sprintId: string, moveTo: string | null) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.sprint.updateMany({
      where: { id: sprintId, status: 'active' },
      data: { status: 'completed' },
    });
    if (count === 0) return false;

    const open = await tx.task.findMany({
      where: { sprintId, parentId: null, status: { not: 'done' } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true, status: true },
    });

    // Cards keep their order and land at the bottom of their column.
    const last = new Map<TaskStatus, number>();
    for (const { id, status } of open) {
      if (!last.has(status)) {
        const { _max } = await tx.task.aggregate({
          where: { projectId, sprintId: moveTo, status },
          _max: { position: true },
        });
        last.set(status, _max.position ?? 0);
      }
      const position = (last.get(status) ?? 0) + 1000;
      last.set(status, position);
      await tx.task.update({ where: { id }, data: { sprintId: moveTo, position } });
    }

    await tx.task.updateMany({
      where: { parentId: { in: open.map((t) => t.id) } },
      data: { sprintId: moveTo },
    });
    return true;
  });
}

// The sprint's tasks move to the backlog (ON DELETE SET NULL).
export function remove(sprintId: string) {
  return prisma.sprint.delete({ where: { id: sprintId } });
}
