import { spawnSync } from 'node:child_process'
import path from 'node:path'

/**
 * Run ESLint --fix for staged files without requiring a root-level ESLint install.
 *
 * lint-staged passes file paths relative to repo root.
 * We group them by workspace package and run `pnpm exec eslint --fix` inside that package.
 */

const repoRoot = process.cwd()
const files = process.argv.slice(2)

/** @type {Array<{prefix: string, dir: string}>} */
const packages = [
  { prefix: 'apps/server/', dir: 'apps/server' },
  { prefix: 'apps/admin-web/', dir: 'apps/admin-web' },
  { prefix: 'apps/www-web/', dir: 'apps/www-web' },
  { prefix: 'apps/miniprogram/', dir: 'apps/miniprogram' },
]

/** @type {Map<string, string[]>} */
const grouped = new Map()

for (const file of files) {
  const match = packages.find((p) => file.startsWith(p.prefix))
  if (!match) continue
  const list = grouped.get(match.dir) ?? []
  list.push(file)
  grouped.set(match.dir, list)
}

for (const [pkgDir, pkgFiles] of grouped) {
  const cwd = path.join(repoRoot, pkgDir)
  const relFiles = pkgFiles.map((f) => path.relative(pkgDir, f))

  // eslint is a per-package devDependency (Flat Config). Running inside the package ensures config resolution.
  const res = spawnSync('pnpm', ['exec', 'eslint', '--fix', ...relFiles], {
    cwd,
    stdio: 'inherit',
  })
  if (res.status !== 0) {
    process.exit(res.status ?? 1)
  }
}

