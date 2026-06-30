import globals from "globals";
import { nextJsConfig } from "@alfred/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    // Config files run under Node, not the browser/serviceworker globals
    // the shared Next.js config assumes for app code.
    files: ["*.config.js", "*.config.mjs", "*.config.cjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
];
