import { Sparkles } from 'lucide-react';
import { ErrorText } from '@/components/ErrorText';
import { Window } from '@/components/Window';
import { Button } from '@/components/ui/button';
import { useSprintSummary } from './queries';

// "Summarize sprint": the AI's status of the sprint, shown as it is written.
export function SprintSummary({ projectId, sprintId }: { projectId: string; sprintId: string }) {
  const { state, start, stop, close } = useSprintSummary(projectId, sprintId);
  const streaming = state.status === 'streaming';

  if (state.status === 'idle') {
    return (
      <Button variant="outline" className="w-fit" onClick={() => void start()}>
        <Sparkles className="size-4" aria-hidden />
        Summarize sprint
      </Button>
    );
  }

  return (
    <Window icon={Sparkles} title="Sprint summary" bar="bg-primary text-primary-foreground">
      <div className="grid gap-3 p-4">
        {(state.text || streaming) && (
          <p aria-live="polite" aria-busy={streaming} className="text-sm whitespace-pre-wrap">
            {state.text || 'Thinking…'}
          </p>
        )}
        <ErrorText>{state.error}</ErrorText>
        <div className="flex items-center gap-2">
          {streaming ? (
            <Button size="sm" variant="outline" onClick={stop}>
              Stop
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => void start()}>
                Write again
              </Button>
              <Button size="sm" variant="ghost" onClick={close}>
                Close
              </Button>
            </>
          )}
          <span className="ml-auto font-mono text-[11px] text-muted-foreground uppercase">
            AI-written, check before sharing
          </span>
        </div>
      </div>
    </Window>
  );
}
