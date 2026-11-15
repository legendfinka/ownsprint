import { taskStatusSchema } from '@ownsprint/shared';

// Placeholder until step 5. Importing from @ownsprint/shared proves the workspace wiring.
export function App() {
  return (
    <main>
      <h1>OwnSprint</h1>
      <ul>
        {taskStatusSchema.options.map((status) => (
          <li key={status}>{status}</li>
        ))}
      </ul>
    </main>
  );
}
