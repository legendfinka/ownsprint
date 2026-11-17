import type { Request, Response } from 'express';
import type {
  AddMemberInput,
  ProjectDetail,
  ProjectListResponse,
  ProjectMember,
  ProjectNameInput,
  ProjectSummary,
  UpdateMemberInput,
} from '@ownsprint/shared';
import { requireUserId } from '../../middleware/authenticate';
import * as projects from './projects.service';

type ProjectParams = { projectId: string };
type MemberParams = ProjectParams & { userId: string };

// Params and body are already checked by `validate` in projects.routes.ts.

export async function create(req: Request, res: Response<ProjectSummary>): Promise<void> {
  const project = await projects.createProject(requireUserId(req), req.body as ProjectNameInput);
  res.status(201).json(project);
}

export async function list(req: Request, res: Response<ProjectListResponse>): Promise<void> {
  res.json({ projects: await projects.listProjects(requireUserId(req)) });
}

export async function get(
  req: Request<ProjectParams>,
  res: Response<ProjectDetail>,
): Promise<void> {
  res.json(await projects.getProject(requireUserId(req), req.params.projectId));
}

export async function rename(
  req: Request<ProjectParams>,
  res: Response<ProjectSummary>,
): Promise<void> {
  const input = req.body as ProjectNameInput;
  res.json(await projects.renameProject(requireUserId(req), req.params.projectId, input));
}

export async function remove(req: Request<ProjectParams>, res: Response): Promise<void> {
  await projects.deleteProject(requireUserId(req), req.params.projectId);
  res.status(204).end();
}

export async function addMember(
  req: Request<ProjectParams>,
  res: Response<ProjectMember>,
): Promise<void> {
  const input = req.body as AddMemberInput;
  const member = await projects.addMember(requireUserId(req), req.params.projectId, input);
  res.status(201).json(member);
}

export async function updateMember(
  req: Request<MemberParams>,
  res: Response<ProjectMember>,
): Promise<void> {
  const { projectId, userId } = req.params;
  const input = req.body as UpdateMemberInput;
  res.json(await projects.updateMember(requireUserId(req), projectId, userId, input));
}

export async function removeMember(req: Request<MemberParams>, res: Response): Promise<void> {
  const { projectId, userId } = req.params;
  await projects.removeMember(requireUserId(req), projectId, userId);
  res.status(204).end();
}
