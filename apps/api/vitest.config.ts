import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './test/test-env.ts';

export default defineConfig({
  test: {
    environment: 'node',
    env: TEST_ENV,
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false, // all files share one database
    restoreMocks: true, // a console spy in one test never hides logs in the next
    unstubGlobals: true, // same for a faked fetch
  },
});
