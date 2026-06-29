/**
 * Decides which files in a repository are worth vectorizing. Repos contain a
 * lot of stuff that isn't source code — dependency trees, build output, binary
 * assets, generated/minified bundles, lockfiles — and embedding those wastes
 * OpenAI calls, pollutes the vector index with noise, and slows down review
 * context retrieval. These guardrails keep `code_chunks` limited to actual
 * hand-written source.
 */

/** Path segments that, if present anywhere in a file's path, exclude it entirely. */
const IGNORED_PATH_SEGMENTS = [
  "node_modules",
  "vendor",
  "bower_components",
  ".git",
  ".svn",
  ".hg",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".vercel",
  ".netlify",
  "dist",
  "build",
  "out",
  "output",
  "target",
  "bin",
  "obj",
  "coverage",
  ".nyc_output",
  "__pycache__",
  ".venv",
  "venv",
  "env",
  ".tox",
  "site-packages",
  "Pods",
  "DerivedData",
  ".gradle",
  ".idea",
  ".vscode",
  ".docusaurus",
  "public/build",
];

/** Exact file names to always skip, regardless of extension. */
const IGNORED_FILE_NAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "npm-shrinkwrap.json",
  "composer.lock",
  "poetry.lock",
  "Pipfile.lock",
  "Cargo.lock",
  "Gemfile.lock",
  "go.sum",
  ".ds_store",
]);

/** Filename suffixes that mark generated, minified, or compiled output rather than source. */
const IGNORED_SUFFIXES = [
  ".min.js",
  ".min.css",
  ".map",
  ".d.ts",
  ".lock",
  ".bundle.js",
  ".chunk.js",
  ".generated.ts",
  ".pb.go",
  ".g.dart",
];

/** Extensions recognized as source code worth embedding, mapped to a display language. */
const CODE_EXTENSIONS: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  scala: "scala",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  vue: "vue",
  svelte: "svelte",
  graphql: "graphql",
  gql: "graphql",
  proto: "protobuf",
  yml: "yaml",
  yaml: "yaml",
  json: "json",
  toml: "toml",
  prisma: "prisma",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  md: "markdown",
  mdx: "markdown",
};

/** Files above this size are almost always generated/vendored data, not hand-written source. */
const MAX_FILE_SIZE_BYTES = 200_000;

export interface VectorizableTreeEntry {
  path: string;
  type: "blob" | "tree" | string;
  size?: number;
}

export interface VectorizableFile {
  path: string;
  language: string;
}

function hasIgnoredPathSegment(path: string): boolean {
  const segments = path.split("/");
  return segments.some((segment) => IGNORED_PATH_SEGMENTS.includes(segment));
}

function getExtension(path: string): string | null {
  const fileName = path.split("/").pop() ?? path;
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) return null;
  return fileName.slice(dotIndex + 1).toLowerCase();
}

/**
 * Filters a repository's git tree down to source files safe to embed.
 * Guardrails applied, in order: must be a blob (not a directory/submodule),
 * must not live under an ignored directory (node_modules, dist, .git, etc.),
 * must not be a known lockfile or generated/minified artifact, must have a
 * recognized source-code extension, and must be under the size cap.
 */
export function filterVectorizableFiles(entries: VectorizableTreeEntry[]): VectorizableFile[] {
  const results: VectorizableFile[] = [];

  for (const entry of entries) {
    if (entry.type !== "blob") continue;
    if (!entry.path) continue;
    if (hasIgnoredPathSegment(entry.path)) continue;

    const fileName = (entry.path.split("/").pop() ?? "").toLowerCase();
    if (IGNORED_FILE_NAMES.has(fileName)) continue;
    if (IGNORED_SUFFIXES.some((suffix) => fileName.endsWith(suffix))) continue;

    const extension = getExtension(entry.path);
    if (!extension) continue;

    const language = CODE_EXTENSIONS[extension];
    if (!language) continue;

    if (typeof entry.size === "number" && entry.size > MAX_FILE_SIZE_BYTES) continue;

    results.push({ path: entry.path, language });
  }

  return results;
}
