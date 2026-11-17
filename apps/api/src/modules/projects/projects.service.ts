import {
  fullName,
  type AddMemberInput,
  type ProjectDetail,
  type ProjectMember,
  type ProjectNameInput,
  type ProjectSummary,
  type Role,
  type UpdateMemberInput,
} from '@ownsprint/shared';
import type { Membership, Project, User } from '../../generated/prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { isUniqueConstraintError } from '../../lib/prisma';
import { findUserByEmail } from '../users/users.repository';
import * as repo from './projects.repository';

// The access check for everything inside a project (sprints and tasks too).
// Non-members get 404, so they can't even tell the project exists.
export async function requireAccess(
  userId: string,
  projectId: string,
  role?: 'owner',
): Promise<Membership> {
  const membership = await repo.findMembership(projectId, userId);
  if (!membership) throw new NotFoundError('Project not found');
  if (role === 'owner' && membership.role !== 'owner') {
    throw new ForbiddenError('Only the project owner can do this');
  }
  return membership;
}

export async function isMember(projectId: string, userId: string): Promise<boolean> {
  return (await repo.findMembership(projectId, userId)) !== null;
}

export async function createProject(
  userId: string,
  input: ProjectNameInput,
): Promise<ProjectSummary> {
  const project = await repo.create(input.name, userId);
  return toSummary(project, 'owner');
}

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const memberships = await repo.findMembershipsOfUser(userId);
  return memberships.map((m) => toSummary(m.project, m.role));
}

export async function getProject(userId: string, projectId: string): Promise<ProjectDetail> {
  const { role } = await requireAccess(userId, projectId);
  const project = await repo.findWithMembers(projectId);
  if (!project) throw new NotFoundError('Project not found');

  const members = project.memberships
    .map((m) => toMember(m.user, m.role, m.title))
    // Owner first; the rest stay alphabetical (the sort is stable).
    .sort((a, b) => Number(b.role === 'owner') - Number(a.role === 'owner'));
  return { ...toSummary(project, role), members };
}

export async function renameProject(
  userId: string,
  projectId: string,
  input: ProjectNameInput,
): Promise<ProjectSummary> {
  await requireAccess(userId, projectId, 'owner');
  return toSummary(await repo.rename(projectId, input.name), 'owner');
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  await requireAccess(userId, projectId, 'owner');
  await repo.remove(projectId);
}

export async function addMember(
  userId: string,
  projectId: string,
  input: AddMemberInput,
): Promise<ProjectMember> {
  await requireAccess(userId, projectId, 'owner');

  const user = await findUserByEmail(input.email);
  if (!user) throw new NotFoundError('No user with this email');

  try {
    await repo.addMember(projectId, user.id);
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new ConflictError('User is already a member');
    throw err;
  }
  return toMember(user, 'member', null);
}

export async function updateMember(
  userId: string,
  projectId: string,
  memberId: string,
  input: UpdateMemberInput,
): Promise<ProjectMember> {
  await requireAccess(userId, projectId, 'owner');
  // An empty title clears it.
  const found = await repo.setMemberTitle(projectId, memberId, input.title || null);
  if (!found) throw new NotFoundError('Member not found');

  const member = await repo.findMember(projectId, memberId);
  if (!member) throw new NotFoundError('Member not found');
  return toMember(member.user, member.role, member.title);
}

export async function removeMember(
  userId: string,
  projectId: string,
  memberId: string,
): Promise<void> {
  await requireAccess(userId, projectId, 'owner');
  // Only the owner gets here, so this means "the owner is removing themselves".
  if (memberId === userId) throw new ConflictError('The owner cannot be removed');

  const removed = await repo.removeMember(projectId, memberId);
  if (!removed) throw new NotFoundError('Member not found');
}

function toMember(
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'avatarColor' | 'avatarEmoji'>,
  role: Role,
  title: string | null,
): ProjectMember {
  return {
    id: user.id,
    name: fullName(user.firstName, user.lastName),
    email: user.email,
    // Only values from the shared lists are ever saved, so the casts are safe.
    avatarColor: user.avatarColor as ProjectMember['avatarColor'],
    avatarEmoji: user.avatarEmoji as ProjectMember['avatarEmoji'],
    role,
    title,
  };
}

function toSummary(project: Project, role: Role): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    role,
    createdAt: project.createdAt.toISOString(),
  };
}
