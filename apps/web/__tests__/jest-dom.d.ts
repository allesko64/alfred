// Pulls in @testing-library/jest-dom's vitest matcher type augmentations.
// vitest.setup.ts (repo root) does the runtime import, but it's outside
// apps/web/tsconfig.json's "include" glob, so `tsc --noEmit` here never
// picks up the type augmentation without this file.
import "@testing-library/jest-dom/vitest";
