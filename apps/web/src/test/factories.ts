import type { Task, TaskStatus } from '@ownsprint/shared';

// A task with only the fields a test cares about; the title is the id.
export function makeTask(id: string, status: TaskStatus = 'todo'): Task {
  return {
    id,
    status,
    title: id,
    projectId: 'p',
    sprintId: 's',
    parentId: null,
    description: '',
    priority: 'medium',
    estimate: null,
    assigneeId: null,
    position: 0,
    createdAt: '',
    updatedAt: '',
  };
}
