import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { KeyRound, Mail, UserRound, type LucideIcon } from 'lucide-react';
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  changeEmailSchema,
  changePasswordSchema,
  isDemoEmail,
  updateProfileSchema,
  type PublicUser,
} from '@ownsprint/shared';
import { Avatar } from '@/components/Avatar';
import { ErrorText } from '@/components/ErrorText';
import { FormField } from '@/components/FormField';
import { Window } from '@/components/Window';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/session';
import { useSchemaForm } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { useChangeEmail, useChangePassword, useUpdateProfile } from './queries';

export function SettingsPage() {
  const { data: user } = useSession();
  if (!user) return null; // the page sits behind the login gate

  return (
    <div className="mx-auto grid w-full max-w-xl gap-6">
      <div className="grid gap-1 border-b-2 border-dashed pb-4">
        <Link to="/projects" className="w-fit font-mono text-xs text-primary hover:underline">
          ← all projects
        </Link>
        <h1 className="text-4xl font-semibold">Account settings</h1>
      </div>

      <ProfileForm user={user} />
      {isDemoEmail(user.email) ? (
        // The API refuses these changes for demo accounts anyway.
        <Section icon={KeyRound} title="Demo account">
          <p className="text-sm text-muted-foreground">
            This is a private demo account. Its email and password can’t be changed, and it’s
            deleted after a day. Sign up to keep your work.
          </p>
        </Section>
      ) : (
        <>
          <EmailForm user={user} />
          <PasswordForm />
        </>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Window icon={icon} title={title}>
      <div className="grid gap-4 p-5">{children}</div>
    </Window>
  );
}

function Saved({ show }: { show: boolean }) {
  return show ? (
    <p role="status" className="font-mono text-xs text-muted-foreground">
      ✓ Saved
    </p>
  ) : null;
}

// The form sends strings: an empty colour or emoji means "none".
const profileForm = {
  safeParse: (input: unknown) => {
    const values = input as Record<string, string>;
    return updateProfileSchema.safeParse({
      ...values,
      avatarColor: values.avatarColor || null,
      avatarEmoji: values.avatarEmoji || null,
    });
  },
};

function ProfileForm({ user }: { user: PublicUser }) {
  const update = useUpdateProfile();
  const [color, setColor] = useState(user.avatarColor);
  const [emoji, setEmoji] = useState(user.avatarEmoji);
  const { errors, formError, onSubmit } = useSchemaForm(profileForm, (input) =>
    update.mutateAsync(input),
  );

  return (
    <Section icon={UserRound} title="Profile">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={user.name}
            avatarColor={color}
            avatarEmoji={emoji}
            className="size-14 text-xl"
          />
          <p className="text-sm text-muted-foreground">
            Pick a colour and an emoji, or keep your initials.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="firstName"
            label="First name"
            defaultValue={user.firstName}
            autoComplete="given-name"
            error={errors.firstName}
          />
          <FormField
            name="lastName"
            label="Last name"
            defaultValue={user.lastName}
            autoComplete="family-name"
            error={errors.lastName}
          />
        </div>

        <input type="hidden" name="avatarColor" value={color ?? ''} />
        <input type="hidden" name="avatarEmoji" value={emoji ?? ''} />

        <div role="group" aria-label="Avatar colour" className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((value) => (
            <Choice
              key={value}
              label={`Colour ${value}`}
              selected={color === value}
              onClick={() => setColor(value)}
              style={{ backgroundColor: value }}
            />
          ))}
        </div>

        <div role="group" aria-label="Avatar emoji" className="flex flex-wrap gap-1.5">
          <Choice label="Initials" selected={emoji === null} onClick={() => setEmoji(null)}>
            Aa
          </Choice>
          {AVATAR_EMOJIS.map((value) => (
            <Choice
              key={value}
              label={value}
              selected={emoji === value}
              onClick={() => setEmoji(value)}
            >
              {value}
            </Choice>
          ))}
        </div>

        <ErrorText>{formError}</ErrorText>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={update.isPending}>
            Save profile
          </Button>
          <Saved show={update.isSuccess} />
        </div>
      </form>
    </Section>
  );
}

function Choice({
  label,
  selected,
  onClick,
  style,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      style={style}
      className={cn(
        'grid size-9 place-items-center rounded-sm border-2 text-lg hover:border-foreground',
        selected ? 'border-foreground shadow-hard' : 'border-border',
      )}
    >
      {children}
    </button>
  );
}

function EmailForm({ user }: { user: PublicUser }) {
  const change = useChangeEmail();
  const { errors, formError, onSubmit } = useSchemaForm(changeEmailSchema, async (input, form) => {
    await change.mutateAsync(input);
    form.reset();
  });

  return (
    <Section icon={Mail} title="Email">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField
          name="email"
          id="new-email"
          label="Email"
          type="email"
          defaultValue={user.email}
          autoComplete="email"
          error={errors.email}
        />
        <FormField
          name="currentPassword"
          id="email-current-password"
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword}
        />
        <ErrorText>{formError}</ErrorText>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={change.isPending}>
            Change email
          </Button>
          <Saved show={change.isSuccess} />
        </div>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const { errors, formError, onSubmit } = useSchemaForm(
    changePasswordSchema,
    async (input, form) => {
      await change.mutateAsync(input);
      form.reset();
    },
  );

  return (
    <Section icon={KeyRound} title="Password">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField
          name="currentPassword"
          id="password-current-password"
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword}
        />
        <FormField
          name="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword}
        />
        <p className="text-xs text-muted-foreground">
          Other devices are signed out when you change it.
        </p>
        <ErrorText>{formError}</ErrorText>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={change.isPending}>
            Change password
          </Button>
          <Saved show={change.isSuccess} />
        </div>
      </form>
    </Section>
  );
}
