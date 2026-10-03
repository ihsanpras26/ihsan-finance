// build-api.mjs: bundle the Vercel function into one self-contained JS file (docs/DEPLOY.md).
//
// Why: the server runs TypeScript directly on Node 24, so relative imports carry the `.ts`
// extension. Vercel compiles every `api/*.ts` with its own `tsc` run, keeps the `.ts` specifiers in
// the emitted JS, and ships only the `.js` files — the function then died on its first import
// (production answered 500 FUNCTION_INVOCATION_FAILED). Bundling here inlines the local sources.
//
// Third-party packages are bundled too: the function carries no node_modules of its own, so
// anything left external would be unresolvable at runtime. The native libSQL binding is the one
// exception (below), and schema.sql is inlined through `define` so no asset has to be traced.
// The source lives in the server package, not in `api/`: Vercel rejects `api/index.ts` next to the
// generated `api/index.js` as a conflicting path.
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const outfile = join(root, 'api', 'index.js');
const schemaFile = join(root, 'server', 'src', 'db', 'schema.sql');

// `@libsql/client` and `libsql` are the native driver. They are reached only for `file:` targets,
// which production never uses (Turso over HTTP); leaving them external keeps the platform-specific
// addon out of the bundle. Every `@libsql/client/web` path is bundled.
const nativeDriver = {
  name: 'native-libsql-external',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^(@libsql\/client|libsql)$/ }, (args) => ({ path: args.path, external: true }));
  },
};

await build({
  entryPoints: [join(root, 'server', 'src', 'vercel.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  logLevel: 'warning',
  plugins: [nativeDriver],
  // Bundled CJS dependencies (Fastify, pino) call `require('node:events')` and friends. ESM output
  // has no `require`, and esbuild's fallback throws "Dynamic require of … is not supported", so the
  // bundle carries a real one.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  define: {
    'globalThis.__IHSAN_SCHEMA__': JSON.stringify(readFileSync(schemaFile, 'utf8')),
  },
});

const kb = (file) => `${Math.round(statSync(file).size / 1024)} KB`;
console.log(`api/index.js ${kb(outfile)} (skema inline dari ${join('server', 'src', 'db', 'schema.sql')})`);
