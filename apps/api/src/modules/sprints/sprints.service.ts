import type {
  CompleteSprintInput,
  CreateSprintInput,
  Sprint,
  SprintStatus,
  UpdateSprintInput,
} from '@ownsprint/shared';
import type { Sprint as SprintRow } from '../../generated/prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import { requireAccess } from '../projects/projects.service';
import * as repo from './sprints.repository';

export async function listSprints(userId: string, projectId: string): Promise<Sprint[]> {
  await requireAccess(userId, projectId);
  return (await repo.list(projectId)).map(toSprint);
}

export async function getSprintById(
  userId: string,
  projectId: string,
  sprintId: string,
): Promise<Sprint> {
  await requireAccess(userId, projectId);
  return toSprint(await getSprint(projectId, sprintId));
}

export async function createSprint(
  userId: string,
  projectId: string,
  input: CreateSprintInput,
): Promise<Sprint> {
  await requireAccess(userId, projectId);
  checkDates(input.startDate, input.endDate);

  const sprint = await repo.create({
    projectId,
    name: input.name,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
  });
  return toSprint(sprint);
}

export async function updateSprint(
  userId: string,
  projectId: string,
  sprintId: string,
  input: UpdateSprintInput,
): Promise<Sprint> {
  await requireAccess(userId, projectId);
  const sprint = await getSprint(projectId, sprintId);

  // Check the dates as they'll be after the update, not just the ones sent.
  const current = toSprint(sprint);
  checkDates(input.startDate ?? current.startDate, input.endDate ?? current.endDate);

  const updated = await repo.update(sprintId, {
    name: input.name,
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
  });
  return toSprint(updated);
}

export async function startSprint(
  userId: string,
  projectId: string,
  sprintId: string,
): Promise<Sprint> {
  await requireAccess(userId, projectId);
  const sprint = await getSprint(projectId, sprintId);
  if (sprint.status !== 'planned') throw new ConflictError('Only a planned sprint can be started');

  // One active sprint per project, so the board knows what to show.
  // Not race-proof: two starts at the same moment could both pass.
  const active = await repo.findOtherActive(projectId, sprintId);
  if (active) throw new ConflictError(`"${active.name}" is already active`);

  return toSprint(await repo.update(sprintId, { status: 'active' }));
}

// Owner only: it closes the sprint for everyone.
export async function completeSprint(
  userId: string,
  projectId: string,
  sprintId: string,
  { moveTo }: CompleteSprintInput,
): Promise<Sprint> {
  await requireAccess(userId, projectId, 'owner');
  await getSprint(projectId, sprintId);

  if (moveTo !== null) {
    const target = await repo.find(projectId, moveTo);
    if (target?.status !== 'planned') {
      throw ValidationError.fields({ moveTo: 'Pick a planned sprint of this project' });
    }
  }

  if (!(await repo.complete(projectId, sprintId, moveTo))) {
    throw new ConflictError('Only an active sprint can be completed');
  }
  return toSprint(await getSprint(projectId, sprintId));
}

export async function deleteSprint(
  userId: string,
  projectId: string,
  sprintId: string,
): Promise<void> {
  await requireAccess(userId, projectId);
  await getSprint(projectId, sprintId);
  await repo.remove(sprintId);
}

// Used by tasks: the status of a sprint of this project, null if there is none.
export async function sprintStatus(
  projectId: string,
  sprintId: string,
): Promise<SprintStatus | null> {
  return (await repo.find(projectId, sprintId))?.status ?? null;
}

async function getSprint(projectId: string, sprintId: string): Promise<SprintRow> {
  const sprint = await repo.find(projectId, sprintId);
  if (!sprint) throw new NotFoundError('Sprint not found');
  return sprint;
}

// "YYYY-MM-DD" strings compare correctly as plain text.
function checkDates(startDate: string, endDate: string): void {
  if (endDate < startDate) {
    throw ValidationError.fields({ endDate: 'End date cannot be before start date' });
  }
}

function toSprint(sprint: SprintRow): Sprint {
  return {
    id: sprint.id,
    projectId: sprint.projectId,
    name: sprint.name,
    startDate: sprint.startDate.toISOString().slice(0, 10),
    endDate: sprint.endDate.toISOString().slice(0, 10),
    status: sprint.status,
  };
}
