import { prisma } from '../../lib/prisma';

// Project and owner membership are created in one query, so they can't get out of sync.
export function create(name: string, ownerId: string) {
  return prisma.project.create({
    data: { name, ownerId, memberships: { create: { userId: ownerId, role: 'owner' } } },
  });
}

export function findMembership(projectId: string, userId: string) {
  return prisma.membership.findUnique({ where: { userId_projectId: { userId, projectId } } });
}

export function findMembershipsOfUser(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: { project: true },
    orderBy: { project: { createdAt: 'desc' } },
  });
}

export function findWithMembers(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      memberships: {
        select: { role: true, user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: 'asc' } },
      },
    },
  });
}

export function rename(projectId: string, name: string) {
  return prisma.project.update({ where: { id: projectId }, data: { name } });
}

// Memberships, sprints and tasks are removed by the database (ON DELETE CASCADE).
export function remove(projectId: string) {
  return prisma.project.delete({ where: { id: projectId } });
}

export function addMember(projectId: string, userId: string) {
  return prisma.membership.create({ data: { projectId, userId, role: 'member' } });
}

export async function removeMember(projectId: string, userId: string): Promise<boolean> {
  const { count } = await prisma.membership.deleteMany({ where: { projectId, userId } });
  return count === 1;
}
