/**
 * Antigravity Academy — Architectural Boundary Rules (dependency-cruiser)
 *
 * Executed via `pnpm run arch:check` and automatically by
 * `skills/cf-next-verify/scripts/verify-stack.sh` (Step 4b).
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Circular dependencies hinder tree-shaking, modularity, and deterministic testing.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-server-or-db-in-ui',
      comment: 'UI components must never import server-only modules, database clients, or Node filesystem/process APIs directly.',
      severity: 'error',
      from: { path: '^src/components/' },
      to: {
        path: '(^src/(db|server)/|(^|/)server-only$|supabase.*admin|firebase-admin|(^|/)prisma(/|$)|(^|/)drizzle(/|$)|^(node:)?(fs|child_process|net|tls)$)',
      },
    },
    {
      name: 'no-lib-importing-app-or-ui',
      comment: 'Domain & schema modules in src/lib/ must not import Next.js routes (src/app/) or UI components (src/components/).',
      severity: 'error',
      from: { path: '^src/lib/' },
      to: { path: '^src/(app|components)/' },
    },
    {
      name: 'no-cross-feature-imports',
      comment: 'Feature slices under src/features/<name>/ must stay isolated; share contracts via src/shared/ or src/lib/.',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/',
        pathNot: '^src/features/$1/',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
