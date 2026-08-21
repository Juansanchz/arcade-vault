import { execFileSync } from "node:child_process";
import { existsSync, readSync } from "node:fs";
import { extname, isAbsolute, join, relative } from "node:path";

const ESLINT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
]);
const PRETTIER_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".scss",
]);

function readStdin() {
  const chunks = [];
  const buffer = Buffer.alloc(65536);
  while (true) {
    let bytesRead;
    try {
      bytesRead = readSync(0, buffer, 0, buffer.length, null);
    } catch (err) {
      if (err.code === "EAGAIN") continue;
      if (err.code === "EOF") break;
      throw err;
    }
    if (bytesRead === 0) break;
    chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin());
  } catch {
    process.exit(0);
  }

  const filePath = input?.tool_input?.file_path;
  if (!filePath) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const absPath = isAbsolute(filePath) ? filePath : join(projectDir, filePath);

  const rel = relative(projectDir, absPath);
  if (rel.startsWith("..") || isAbsolute(rel)) process.exit(0);
  if (!existsSync(absPath)) process.exit(0);

  const ext = extname(absPath).toLowerCase();
  let eslintRemainingErrors = null;

  if (ESLINT_EXTENSIONS.has(ext)) {
    try {
      execFileSync(
        "npx",
        ["--yes", "eslint", "--fix", "--max-warnings", "0", absPath],
        {
          cwd: projectDir,
          stdio: ["ignore", "pipe", "pipe"],
          shell: true,
        },
      );
    } catch (err) {
      eslintRemainingErrors = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
    }
  }

  if (PRETTIER_EXTENSIONS.has(ext)) {
    try {
      execFileSync("npx", ["--yes", "prettier", "--write", absPath], {
        cwd: projectDir,
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });
    } catch (err) {
      process.stderr.write(
        `[format-on-write] Prettier fallo en ${rel}:\n${err.stdout ?? ""}${err.stderr ?? ""}\n`,
      );
    }
  }

  if (eslintRemainingErrors) {
    process.stderr.write(
      `[format-on-write] ESLint encontro errores que no se pudieron arreglar automaticamente en ${rel}:\n\n${eslintRemainingErrors}\n`,
    );
    process.exit(2);
  }

  process.exit(0);
}

main();
