import { Users } from 'lucide-react';
import {
  addMemberSchema,
  MEMBER_TITLES,
  type ProjectDetail,
  type ProjectMember,
} from '@ownsprint/shared';
import { Avatar } from '@/components/Avatar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorText } from '@/components/ErrorText';
import { Select } from '@/components/Select';
import { Window } from '@/components/Window';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, useSchemaForm } from '@/lib/forms';
import { useAddMember, useRemoveMember, useSetMemberTitle } from './queries';

// The people of a project. The owner can add and remove members and give each
// a title ("Developer", "Tester"…): a label for the team, not a permission.
export function Members({ project }: { project: ProjectDetail }) {
  const isOwner = project.role === 'owner';

  return (
    <Window icon={Users} title={`Members (${String(project.members.length)})`}>
      <ul className="grid gap-4 p-4">
        {project.members.map((member) => (
          <MemberRow key={member.id} projectId={project.id} member={member} canManage={isOwner} />
        ))}
      </ul>
      {isOwner && <AddMemberForm projectId={project.id} />}
    </Window>
  );
}

const titles: readonly string[] = MEMBER_TITLES;

interface RowProps {
  projectId: string;
  member: ProjectMember;
  canManage: boolean; // the current user is the owner
}

function MemberRow({ projectId, member, canManage }: RowProps) {
  const setTitle = useSetMemberTitle(projectId);
  const removeMember = useRemoveMember(projectId);

  return (
    <li className="grid gap-2 text-sm">
      <div className="flex items-center gap-3">
        <Avatar
          name={member.name}
          avatarColor={member.avatarColor}
          avatarEmoji={member.avatarEmoji}
        />
        <span className="grid min-w-0">
          <span className="truncate font-medium">{member.name}</span>
          <span className="truncate text-xs text-muted-foreground">{member.email}</span>
        </span>
        {member.role === 'owner' && (
          <span className="ml-auto border px-1.5 font-mono text-[11px] tracking-wider uppercase">
            Owner
          </span>
        )}
      </div>

      {canManage ? (
        <div className="flex items-center gap-2">
          {/* Saves on change. A title set some other way (the API takes any
              text) stays in the list, so the select can show it. */}
          <Select
            key={member.title ?? ''}
            aria-label={`Title of ${member.name}`}
            defaultValue={member.title ?? ''}
            onChange={(e) => setTitle.mutate({ userId: member.id, title: e.target.value })}
            className="flex-1 text-xs"
          >
            <option value="">No title</option>
            {member.title && !titles.includes(member.title) && (
              <option value={member.title}>{member.title}</option>
            )}
            {MEMBER_TITLES.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </Select>
          {member.role !== 'owner' && (
            <ConfirmDialog
              trigger="Remove"
              title={`Remove ${member.name}?`}
              description={
                <>
                  <strong>{member.name}</strong> loses access to this project, and their tasks
                  become unassigned.
                </>
              }
              confirmLabel="Remove member"
              onConfirm={() => removeMember.mutateAsync(member.id)}
            />
          )}
        </div>
      ) : (
        member.title && (
          <span className="w-fit rounded-sm bg-muted px-1.5 font-mono text-[11px] uppercase">
            {member.title}
          </span>
        )
      )}
      <ErrorText compact>{setTitle.error && errorMessage(setTitle.error)}</ErrorText>
    </li>
  );
}

// Adds someone who already has an account, by email.
function AddMemberForm({ projectId }: { projectId: string }) {
  const addMember = useAddMember(projectId);
  const { errors, formError, onSubmit } = useSchemaForm(addMemberSchema, async (input, form) => {
    await addMember.mutateAsync(input);
    form.reset();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-2 border-t-2 border-dashed p-4">
      <div className="flex gap-2">
        <Input
          name="email"
          type="email"
          placeholder="Email of a member"
          aria-label="Member email"
        />
        <Button type="submit" variant="outline" disabled={addMember.isPending}>
          Add
        </Button>
      </div>
      <ErrorText>{errors.email ?? formError}</ErrorText>
    </form>
  );
}
