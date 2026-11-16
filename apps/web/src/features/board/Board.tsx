import { useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ErrorText } from '@/components/ErrorText';
import { AddTaskForm } from './AddTaskForm';
import { Column } from './Column';
import { useBoard, useMoveTask } from './queries';
import { COLUMNS, dropToMove } from './reorder';
import { TaskCard } from './TaskCard';

export function Board({ projectId, sprintId }: { projectId: string; sprintId: string }) {
  const { data: tasks, isPending, error } = useBoard(projectId, sprintId);
  const moveTask = useMoveTask(projectId, sprintId);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(
    // A small distance, so a click on a card is not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (isPending) return <p className="text-sm text-muted-foreground">Loading board…</p>;
  if (error) return <ErrorText>{error.message}</ErrorText>;

  function onDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!tasks || !over) return;
    const move = dropToMove(tasks, String(active.id), String(over.id));
    if (move) moveTask.mutate(move);
  }

  const dragging = tasks.find((t) => t.id === draggingId);

  return (
    <div className="grid gap-2">
      <ErrorText>
        {moveTask.error && `Could not move the card: ${moveTask.error.message}`}
      </ErrorText>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={({ active }) => setDraggingId(String(active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map(({ status, title }) => (
            <Column
              key={status}
              status={status}
              title={title}
              tasks={tasks.filter((t) => t.status === status)}
            >
              {status === 'todo' && <AddTaskForm projectId={projectId} sprintId={sprintId} />}
            </Column>
          ))}
        </div>
        {/* The card under the pointer, drawn above every column. */}
        <DragOverlay>{dragging && <TaskCard task={dragging} lifted />}</DragOverlay>
      </DndContext>
    </div>
  );
}
