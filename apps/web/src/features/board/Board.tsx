import { useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ErrorText } from '@/components/ErrorText';
import { BulkEstimate } from '@/features/ai/BulkEstimate';
import { TaskDialog } from '@/features/tasks/TaskDialog';
import { AddTaskForm } from './AddTaskForm';
import { Column } from './Column';
import { sprintPoints } from './points';
import { useBoard, useMoveTask } from './queries';
import { COLUMNS, dropToMove, type Move } from './reorder';
import { SprintProgress } from './SprintProgress';
import { TaskCard } from './TaskCard';

// The drop target is whatever is under the finger or mouse. Between cards (or
// with the keyboard, which has no pointer) the nearest corners decide.
const underPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCorners(args);
};

export function Board({ projectId, sprintId }: { projectId: string; sprintId: string }) {
  const { data: tasks, isPending, error } = useBoard(projectId, sprintId);
  const moveTask = useMoveTask(projectId, sprintId);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Where the dragged card would land right now (null = back where it was).
  const [preview, setPreview] = useState<Move | null>(null);
  const sensors = useSensors(
    // Mouse: a small distance, so a click on a card is not a drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Touch: press and hold to lift a card, so a normal swipe still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Only Space lifts a card; Enter is kept for opening it.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Tab'] },
    }),
  );

  if (isPending) return <p className="text-sm text-muted-foreground">Loading board…</p>;
  if (error) return <ErrorText>{error.message}</ErrorText>;

  // The same function decides the preview and the drop, so they always agree.
  const moveFor = ({ active, over }: DragOverEvent) =>
    tasks && over ? dropToMove(tasks, String(active.id), String(over.id)) : null;

  function onDragEnd(event: DragEndEvent) {
    const move = moveFor(event);
    setDraggingId(null);
    setPreview(null);
    if (move) moveTask.mutate(move);
  }

  function onDragCancel() {
    setDraggingId(null);
    setPreview(null);
  }

  const dragging = tasks.find((t) => t.id === draggingId);
  // Worked out from the same list the columns show, so a drag updates it at once.
  const points = sprintPoints(tasks);

  return (
    <div className="grid gap-4">
      <SprintProgress
        points={points}
        action={<BulkEstimate projectId={projectId} sprintId={sprintId} tasks={tasks} />}
      />
      <ErrorText>
        {moveTask.error && `Could not move the card: ${moveTask.error.message}`}
      </ErrorText>
      <DndContext
        sensors={sensors}
        collisionDetection={underPointer}
        // On a phone the columns scroll sideways while dragging. The default
        // speed (10 px every 5 ms) flies past the middle column; this is slower.
        autoScroll={{ acceleration: 3, threshold: { x: 0.15, y: 0.15 } }}
        onDragStart={({ active }) => setDraggingId(String(active.id))}
        onDragOver={(event) => setPreview(moveFor(event))}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {/* Phones: one column per screen, swiped sideways and snapping into
            place (the next one peeks in). Snapping is off while dragging: it
            would pull the scroll back and forth. Wider screens: three columns. */}
        <div
          className={`-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 ${
            draggingId ? 'snap-none' : 'snap-x snap-mandatory'
          }`}
        >
          {COLUMNS.map(({ status, title }) => (
            // grid: the column stretches to the tallest one, like before.
            <div key={status} className="grid w-[85%] shrink-0 snap-center md:w-auto">
              <Column
                status={status}
                title={title}
                tasks={tasks.filter((t) => t.status === status)}
                points={points.byStatus[status]}
                dropTarget={preview?.status === status ? preview : undefined}
              >
                {status === 'todo' && <AddTaskForm projectId={projectId} sprintId={sprintId} />}
              </Column>
            </div>
          ))}
        </div>
        {/* The card under the pointer, drawn above every column. */}
        <DragOverlay>{dragging && <TaskCard task={dragging} lifted />}</DragOverlay>
      </DndContext>
      <TaskDialog projectId={projectId} />
    </div>
  );
}
