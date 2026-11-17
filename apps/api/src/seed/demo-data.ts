import { randomUUID } from 'node:crypto';
import {
  DEMO_EMAIL_DOMAIN,
  isDemoEmail,
  type Priority,
  type SprintStatus,
  type TaskStatus,
} from '@ownsprint/shared';
import type { Prisma, User } from '../generated/prisma/client';
import { hashPassword } from '../lib/password';
import { prisma } from '../lib/prisma';

// The fixed login `pnpm --filter api seed` creates: for local use and
// screenshots. Visitors of the live demo get their own account instead.
export const SEED_ACCOUNT = {
  email: 'demo@ownsprint.dev',
  password: 'demo-password-123',
  teammateEmail: 'maya@ownsprint.dev',
} as const;

// How long a visitor's demo account lives.
const DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000;

interface TaskSeed {
  title: string;
  status?: TaskStatus; // default: todo
  priority?: Priority; // default: medium
  estimate?: number;
  assignee?: 'demo' | 'maya';
  description?: string;
  subtasks?: { title: string; status?: TaskStatus }[];
}

interface SprintSeed {
  name: string;
  status: SprintStatus;
  starts: number; // days from today
  ends: number;
  tasks: TaskSeed[];
}

// Dates are relative to today, so the demo always looks current.
const SPRINTS: SprintSeed[] = [
  {
    name: 'Sprint 1 · Foundations',
    status: 'completed',
    starts: -21,
    ends: -8,
    tasks: [
      { title: 'Set up the CI pipeline', status: 'done', estimate: 3, assignee: 'maya' },
      { title: 'Design system tokens', status: 'done', estimate: 5, assignee: 'maya' },
      {
        title: 'Sign-up and login flow',
        status: 'done',
        priority: 'high',
        estimate: 5,
        assignee: 'demo',
      },
      { title: 'App shell and navigation', status: 'done', estimate: 3, assignee: 'demo' },
    ],
  },
  {
    name: 'Sprint 2 · Onboarding',
    status: 'active',
    starts: -7,
    ends: 6,
    tasks: [
      { title: 'Welcome screens', status: 'done', priority: 'high', estimate: 3, assignee: 'maya' },
      { title: 'Email verification screen', status: 'done', estimate: 2, assignee: 'demo' },
      {
        title: 'Push notification permissions',
        status: 'in_progress',
        priority: 'high',
        estimate: 5,
        assignee: 'demo',
        description: 'Ask at the right moment, explain why, and handle "don\'t allow" gracefully.',
        subtasks: [
          { title: 'Write the prompt copy', status: 'done' },
          { title: 'iOS permission flow', status: 'in_progress' },
          { title: 'Android permission flow' },
        ],
      },
      { title: 'Profile photo upload', status: 'in_progress', estimate: 3, assignee: 'maya' },
      { title: 'Fix keyboard covering the login button', priority: 'high', estimate: 1 },
      { title: 'Onboarding analytics events', priority: 'low', estimate: 3 },
      { title: 'Accessibility audit of sign-up', estimate: 5, assignee: 'demo' },
      { title: 'Dark mode colours' }, // no estimate: shows the "no estimate" warning
    ],
  },
  {
    name: 'Sprint 3 · Payments',
    status: 'planned',
    starts: 7,
    ends: 20,
    tasks: [
      { title: 'Integrate the payment provider', priority: 'high', estimate: 8 },
      { title: 'Receipt emails', estimate: 3 },
      { title: 'Refund flow', estimate: 5 },
    ],
  },
];

const BACKLOG = ['Offline mode', 'Home screen widget', 'Localisation (Spanish, German)'];

// Midnight UTC, `days` from today: what a Postgres DATE column expects.
function day(days: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

// The seeded login and the visitor accounts are public, so nobody may change
// their email or password.
export function isDemoUser(email: string): boolean {
  return email === SEED_ACCOUNT.email || isDemoEmail(email);
}

// The seeded login. Deletes the old one first, so re-running resets it.
export async function seedDemo(): Promise<void> {
  // Hashing is slow on purpose, so it happens before the transaction opens.
  const passwordHash = await hashPassword(SEED_ACCOUNT.password);
  const mayaHash = await hashPassword(randomUUID()); // nobody logs in as Maya
  const emails = [SEED_ACCOUNT.email, SEED_ACCOUNT.teammateEmail];

  await prisma.$transaction(
    async (tx) => {
      await deleteUsers(tx, { email: { in: emails } });
      await createWorkspace(tx, {
        demo: { email: SEED_ACCOUNT.email, passwordHash },
        maya: { email: SEED_ACCOUNT.teammateEmail, passwordHash: mayaHash },
      });
    },
    { timeout: 60_000 }, // many small queries, maybe to a far-away database
  );
}

// "Try demo account": a fresh private account with its own sample project, so
// visitors never see each other's changes. Accounts older than a day are
// deleted on the way, so no cron job is needed.
export async function createVisitorDemo(): Promise<User> {
  // Visitors are signed in by cookie, never by password.
  const passwordHash = await hashPassword(randomUUID());
  const id = randomUUID();
  const expired = new Date(Date.now() - DEMO_LIFETIME_MS);

  return prisma.$transaction(
    async (tx) => {
      await deleteUsers(tx, {
        email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` },
        createdAt: { lt: expired },
      });
      return createWorkspace(tx, {
        demo: { email: `${id}@${DEMO_EMAIL_DOMAIN}`, passwordHash },
        maya: { email: `maya-${id}@${DEMO_EMAIL_DOMAIN}`, passwordHash },
      });
    },
    { timeout: 30_000 },
  );
}

// A project can't outlive its owner (ON DELETE RESTRICT), so projects go first.
async function deleteUsers(tx: Prisma.TransactionClient, where: Prisma.UserWhereInput) {
  const users = await tx.user.findMany({ where, select: { id: true } });
  const ids = users.map((u) => u.id);
  await tx.project.deleteMany({ where: { ownerId: { in: ids } } });
  await tx.user.deleteMany({ where: { id: { in: ids } } });
}

interface Login {
  email: string;
  passwordHash: string;
}

// The demo user, a teammate and the sample project. Returns the demo user.
async function createWorkspace(
  tx: Prisma.TransactionClient,
  logins: { demo: Login; maya: Login },
): Promise<User> {
  const demo = await tx.user.create({
    data: {
      ...logins.demo,
      firstName: 'Demo',
      lastName: 'User',
      avatarColor: '#e8c468',
      avatarEmoji: '🚀',
    },
  });
  const maya = await tx.user.create({
    data: {
      ...logins.maya,
      firstName: 'Maya',
      lastName: 'Chen',
      avatarColor: '#a8c3a0',
      avatarEmoji: '🦊',
    },
  });
  const assignees = { demo: demo.id, maya: maya.id };

  const project = await tx.project.create({
    data: {
      name: 'Acme Mobile App',
      ownerId: demo.id,
      memberships: {
        create: [
          { userId: demo.id, role: 'owner', title: 'Product' },
          { userId: maya.id, role: 'member', title: 'Developer' },
        ],
      },
    },
  });

  // Cards in a column are spaced 1000 apart, like the app does.
  const nextPosition = new Map<string, number>();
  const position = (sprintId: string | null, status: TaskStatus) => {
    const key = `${sprintId ?? 'backlog'}:${status}`;
    const next = (nextPosition.get(key) ?? 0) + 1000;
    nextPosition.set(key, next);
    return next;
  };

  async function createTask(sprintId: string | null, task: TaskSeed) {
    const status = task.status ?? 'todo';
    const parent = await tx.task.create({
      data: {
        projectId: project.id,
        sprintId,
        title: task.title,
        description: task.description ?? '',
        status,
        priority: task.priority ?? 'medium',
        estimate: task.estimate ?? null,
        assigneeId: task.assignee ? assignees[task.assignee] : null,
        position: position(sprintId, status),
      },
    });
    for (const sub of task.subtasks ?? []) {
      await tx.task.create({
        data: {
          projectId: project.id,
          sprintId,
          parentId: parent.id,
          title: sub.title,
          status: sub.status ?? 'todo',
          position: position(sprintId, sub.status ?? 'todo'),
        },
      });
    }
  }

  for (const sprint of SPRINTS) {
    const { id } = await tx.sprint.create({
      data: {
        projectId: project.id,
        name: sprint.name,
        status: sprint.status,
        startDate: day(sprint.starts),
        endDate: day(sprint.ends),
      },
    });
    for (const task of sprint.tasks) await createTask(id, task);
  }
  for (const title of BACKLOG) await createTask(null, { title, priority: 'low' });

  return demo;
}
