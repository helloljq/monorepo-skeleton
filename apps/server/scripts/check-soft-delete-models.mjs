import fs from 'node:fs';
import path from 'node:path';

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function findModelsWithDeletedAt(schemaText) {
  const models = [];
  const modelRegex = /model\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = modelRegex.exec(schemaText)) !== null) {
    const name = m[1];
    const body = m[2];
    const hasDeletedAt = /\bdeletedAt\b/.test(body);
    if (hasDeletedAt) models.push(name);
  }
  return models;
}

function parseSoftDeleteModelsFromPrismaService(fileText) {
  // Expect: const SOFT_DELETE_MODELS = new Set<string>(['User', 'Xxx']);
  const regex =
    /const\s+SOFT_DELETE_MODELS\s*=\s*new\s+Set<[^>]*>\s*\(\s*\[([\s\S]*?)\]\s*\)\s*;/m;
  const match = regex.exec(fileText);
  if (!match) {
    return null;
  }
  const inside = match[1];
  const stringRegex = /'([^']+)'/g;
  const names = [];
  let sm;
  while ((sm = stringRegex.exec(inside)) !== null) {
    names.push(sm[1]);
  }
  return names;
}

function assertEqualSets(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  const onlyA = [...sa].filter((x) => !sb.has(x)).sort();
  const onlyB = [...sb].filter((x) => !sa.has(x)).sort();
  return { ok: onlyA.length === 0 && onlyB.length === 0, onlyA, onlyB };
}

const repoRoot = process.cwd();
const schemaPath = path.join(repoRoot, 'prisma', 'schema.prisma');
const prismaServicePath = path.join(
  repoRoot,
  'src',
  'database',
  'prisma',
  'prisma.service.ts',
);

if (!fs.existsSync(schemaPath)) {
  console.error(`[soft-delete-check] schema not found: ${schemaPath}`);
  process.exit(2);
}
if (!fs.existsSync(prismaServicePath)) {
  console.error(`[soft-delete-check] prisma service not found: ${prismaServicePath}`);
  process.exit(2);
}

const schemaText = readText(schemaPath);
const prismaServiceText = readText(prismaServicePath);

const modelsWithDeletedAt = findModelsWithDeletedAt(schemaText);
const softDeleteModels = parseSoftDeleteModelsFromPrismaService(prismaServiceText);

if (!softDeleteModels) {
  console.error(
    '[soft-delete-check] Cannot find SOFT_DELETE_MODELS in prisma.service.ts. Please define it as: const SOFT_DELETE_MODELS = new Set<string>([...]);',
  );
  process.exit(1);
}

const result = assertEqualSets(modelsWithDeletedAt, softDeleteModels);
if (!result.ok) {
  console.error('[soft-delete-check] Soft-delete models mismatch.');
  if (result.onlyA.length > 0) {
    console.error(
      `- In schema.prisma has deletedAt but missing in SOFT_DELETE_MODELS: ${result.onlyA.join(', ')}`,
    );
  }
  if (result.onlyB.length > 0) {
    console.error(
      `- In SOFT_DELETE_MODELS but schema.prisma has no deletedAt: ${result.onlyB.join(', ')}`,
    );
  }
  process.exit(1);
}

console.log('[soft-delete-check] OK');


