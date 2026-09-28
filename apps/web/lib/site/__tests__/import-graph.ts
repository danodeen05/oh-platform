/**
 * A small import-graph walker for bundle guards (Task G2a). Starts from every
 * source file under app/[locale]/(site) plus the root and [locale] layouts
 * that wrap them, follows `@/` and relative imports, and marks every module
 * reachable from a "use client" module as client code (it ships to the
 * browser). Package imports are recorded, not followed.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const WEB = path.resolve(__dirname, "../../..");

export interface GraphNode {
  file: string;
  rel: string;
  src: string;
  client: boolean;
  /** Package specifiers imported statically (e.g. "@clerk/nextjs"). */
  packages: string[];
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(WEB, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const suffix of ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"]) {
    const p = base + suffix;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

const USE_CLIENT = /^\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*["']use client["']/;
const STATIC_IMPORTS = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORTS = /import\s*\(\s*["']([^"']+)["']\s*\)/g;

/**
 * The (site) graph. `followDynamic`: also follow `import("...")` (lazy
 * chunks), for checks that must cover code loaded later too. `skipLab`:
 * leave out the dev-only (site)/lab pages (they 404 in production).
 */
export function siteGraph({ followDynamic, skipLab = false }: { followDynamic: boolean; skipLab?: boolean }): Map<string, GraphNode> {
  const starts = [
    ...walk(path.join(WEB, "app/[locale]/(site)")).filter(
      (f) => /\.(tsx?|jsx?)$/.test(f) && !f.includes("__tests__") && !(skipLab && f.includes(`${path.sep}lab${path.sep}`)),
    ),
    path.join(WEB, "app/[locale]/layout.tsx"),
    path.join(WEB, "app/layout.tsx"),
  ];
  const nodes = new Map<string, GraphNode>();
  const seen = new Set<string>();
  const visit = (file: string, inClient: boolean) => {
    const key = `${file}|${inClient}`;
    if (seen.has(key)) return;
    seen.add(key);
    const src = readFileSync(file, "utf8");
    const client = inClient || USE_CLIENT.test(src);
    const node = nodes.get(file) ?? { file, rel: path.relative(WEB, file), src, client, packages: [] };
    node.client ||= client;
    nodes.set(file, node);
    const specs = [...src.matchAll(STATIC_IMPORTS)].map((m) => m[1]);
    // `import type` never reaches the bundle.
    const typeOnly = new Set([...src.matchAll(/import\s+type\s+[^"';]*?from\s+["']([^"']+)["']/g)].map((m) => m[1]));
    for (const spec of specs) {
      if (typeOnly.has(spec)) continue;
      const next = resolveImport(file, spec);
      if (next) visit(next, client);
      else if (!spec.startsWith(".") && !spec.startsWith("@/") && !node.packages.includes(spec)) node.packages.push(spec);
    }
    if (followDynamic) {
      for (const m of src.matchAll(DYNAMIC_IMPORTS)) {
        const next = resolveImport(file, m[1]);
        if (next) visit(next, client);
      }
    }
  };
  for (const s of starts) visit(s, false);
  return nodes;
}
