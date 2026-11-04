/// <reference types="vite/client" />
// Lets convex-test load every Convex function file (including _generated).
export const modules = import.meta.glob(["./**/*.ts", "./**/*.js", "!./**/*.test.ts", "!./**/*.d.ts"]);
