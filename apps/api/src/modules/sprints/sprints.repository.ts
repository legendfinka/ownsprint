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

// The sprint's tasks move to the backlog (ON DELETE SET NULL).
export function remove(sprintId: string) {
  return prisma.sprint.delete({ where: { id: sprintId } });
}
