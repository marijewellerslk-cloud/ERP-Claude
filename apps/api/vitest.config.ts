import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        setupFiles: ['src/tests/setup.ts'],
        testTimeout: 10000,
        fileParallelism: false,
    },
});
