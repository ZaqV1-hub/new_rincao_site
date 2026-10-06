import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, readdirSync, realpathSync, rmSync, statfsSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const COMMIT = /^[a-f0-9]{40}$/;
const GENERATED = new Set(['.next', 'node_modules', 'server.js']);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBlobHash = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const identity = (path) => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
const freeBytes = (root) => { const d = statfsSync(root); return Number(d.bavail) * Number(d.bsize); };

function validateRoot(root) {
  const canonical = resolve(root);
  assert.equal(basename(canonical).toLowerCase(), 'hml', 'hml_root_required');
  assert.equal(identity(realpathSync(canonical)), identity(canonical), 'deployment_root_link_forbidden');
  const releases = join(canonical, 'releases');
  assert.equal(identity(realpathSync(releases)), identity(releases), 'releases_root_link_forbidden');
  return canonical;
}

function pointer(root, name, required = false) {
  const file = join(root, name);
  if (!existsSync(file)) { assert.ok(!required, 'current_pointer_required'); return null; }
  const bytes = readFileSync(file);
  const target = bytes.toString('utf8').replace(/^\uFEFF/, '').trim();
  assert.ok(isAbsolute(target), 'release_pointer_absolute_required');
  assert.equal(identity(dirname(target)), identity(join(root, 'releases')), 'release_pointer_outside_root');
  assert.ok(!lstatSync(target).isSymbolicLink(), 'release_pointer_link_forbidden');
  return { release: basename(target), hash: digest(bytes) };
}

function gitTree(repo, commit) {
  const output = execFileSync('git', ['-C', repo, 'ls-tree', '-r', '-z', commit], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Map(output.split('\0').filter(Boolean).map((record) => {
    const [header, file] = record.split('\t');
    const [mode, type, hash] = header.split(' ');
    return [file, { mode, type, hash }];
  }));
}

function sourceFingerprint(directory, tree) {
  const files = [];
  const walk = (parent) => {
    for (const name of readdirSync(parent).sort()) {
      const file = join(parent, name);
      const key = relative(directory, file).split('\\').join('/');
      if (parent === directory && GENERATED.has(name)) continue;
      const persistent = name.startsWith('.env') || name === '.data' || (parent === directory && ['uploads', 'backups'].includes(name));
      assert.ok(!persistent, 'persistent_or_environment_file_preserved');
      const stat = lstatSync(file);
      assert.ok(!stat.isSymbolicLink(), 'source_link_forbidden');
      if (stat.isDirectory()) {
        assert.ok([...tree.keys()].some((tracked) => tracked.startsWith(`${key}/`)), 'untracked_source_directory');
        walk(file);
        continue;
      }
      assert.ok(stat.isFile(), 'unknown_source_entry');
      const expected = tree.get(key);
      assert.ok(expected?.type === 'blob' && expected.mode !== '120000', 'untracked_source_file');
      const content = readFileSync(file);
      const actual = gitBlobHash(content);
      let canonical = actual;
      if (actual !== expected.hash && !content.includes(0)) {
        try {
          const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(content);
          canonical = gitBlobHash(Buffer.from(text.replace(/\r\n/g, '\n')));
        } catch { /* Binary files must match the original bytes. */ }
      }
      assert.equal(canonical, expected.hash, 'modified_source_file');
      files.push([key, actual]);
    }
  };
  walk(directory);
  assert.ok(files.some(([key]) => key === 'package.json'), 'tracked_package_required');
  return files;
}

export function inspectRelease(root, repo, id) {
  if (!COMMIT.test(id)) return { id, verified: false, reason: 'non_commit_release_preserved' };
  try {
    const directory = join(root, 'releases', id);
    assert.ok(!lstatSync(directory).isSymbolicLink(), 'release_link_forbidden');
    const server = join(directory, 'server.js');
    const buildId = join(directory, '.next', 'BUILD_ID');
    assert.ok(lstatSync(server).isFile() && !lstatSync(server).isSymbolicLink(), 'standalone_server_required');
    assert.ok(!lstatSync(join(directory, '.next')).isSymbolicLink(), 'build_root_link_forbidden');
    assert.ok(lstatSync(join(directory, 'node_modules')).isDirectory() && !lstatSync(join(directory, 'node_modules')).isSymbolicLink(), 'dependency_root_required');
    assert.ok(lstatSync(buildId).isFile() && !lstatSync(buildId).isSymbolicLink(), 'build_identity_required');
    const serverBytes = readFileSync(server);
    assert.ok(serverBytes.includes('next/dist/server/lib/start-server'), 'standalone_server_marker_required');
    const sources = sourceFingerprint(directory, gitTree(repo, id));
    const fingerprint = digest(JSON.stringify({ id, sources, server: digest(serverBytes), build: digest(readFileSync(buildId)) }));
    return { id, verified: true, fingerprint };
  } catch (error) {
    return { id, verified: false, reason: error.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : 'artifact_provenance_unavailable' };
  }
}

export function planRetention({ deploymentRoot, repoRoot, keepReleases = 4, protectedReleases = [] }) {
  assert.ok(Number.isInteger(keepReleases) && keepReleases >= 4, 'minimum_four_releases_required');
  const root = validateRoot(deploymentRoot);
  const repo = realpathSync(repoRoot);
  const current = pointer(root, 'current.txt', true);
  const previous = pointer(root, 'previous.txt');
  const entries = readdirSync(join(root, 'releases'), { withFileTypes: true })
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => ({ id: e.name, modified: lstatSync(join(root, 'releases', e.name)).mtimeMs }))
    .sort((a, b) => b.modified - a.modified || a.id.localeCompare(b.id));
  const protectedIds = [...new Set([current.release, previous?.release, ...protectedReleases, ...entries.slice(0, keepReleases).map((e) => e.id)].filter(Boolean))].sort();
  for (const id of protectedIds) assert.ok(entries.some((e) => e.id === id), 'protected_release_missing');
  const reviewed = entries.filter((e) => !protectedIds.includes(e.id)).map((e) => inspectRelease(root, repo, e.id));
  const removable = reviewed.filter((r) => r.verified).sort((a, b) => a.id.localeCompare(b.id));
  if (removable.length > 0) assert.ok(previous || protectedReleases.length > 0, 'previous_release_identity_required');
  return {
    schema_version: 'hml_release_retention_v1',
    deployment_root: root, repo_root: repo, keep_releases: keepReleases,
    explicit_protected_releases: protectedReleases,
    current, previous, protected_releases: protectedIds, removable,
    preserved_unknown: reviewed.filter((r) => !r.verified).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function assertPointersUnchanged(plan) {
  assert.deepEqual(pointer(plan.deployment_root, 'current.txt', true), plan.current, 'current_pointer_changed');
  assert.deepEqual(pointer(plan.deployment_root, 'previous.txt'), plan.previous, 'previous_pointer_changed');
}

export function applyRetention(plan, { approvedHash, planBytes, receiptFile } = {}) {
  assert.equal(digest(planBytes), approvedHash, 'reviewed_plan_hash_mismatch');
  assert.equal(plan.schema_version, 'hml_release_retention_v1', 'retention_schema_invalid');
  const root = validateRoot(plan.deployment_root);
  const lock = join(root, '.hml-retention.lock');
  const fd = openSync(lock, 'wx');
  closeSync(fd);
  const receipt = { schema_version: 'hml_release_retention_receipt_v1', plan_sha256: approvedHash, status: 'applying', removed: [], protected_releases: plan.protected_releases, free_bytes_before: freeBytes(root), generated_at: new Date().toISOString() };
  const record = () => { receipt.free_bytes_after = freeBytes(root); if (receiptFile) writeFileSync(receiptFile, JSON.stringify(receipt, null, 2)); };
  try {
    const fresh = planRetention({ deploymentRoot: root, repoRoot: plan.repo_root, keepReleases: plan.keep_releases, protectedReleases: plan.explicit_protected_releases });
    assert.deepEqual(fresh, plan, 'retention_plan_changed');
    record();
    for (const candidate of plan.removable) {
      assertPointersUnchanged(plan);
      assert.deepEqual(inspectRelease(root, plan.repo_root, candidate.id), candidate, 'release_changed_after_review');
      rmSync(join(root, 'releases', candidate.id), { recursive: true, force: false });
      receipt.removed.push(candidate.id);
      record();
    }
    assertPointersUnchanged(plan);
    receipt.status = 'applied';
    record();
    return receipt;
  } catch (error) {
    receipt.status = 'failed';
    receipt.error = error.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : 'retention_apply_failed';
    record();
    throw error;
  } finally { rmSync(lock); }
}

function args(argv) {
  const result = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    assert.ok(argv[i]?.startsWith('--') && argv[i + 1] !== undefined, 'argument_value_required');
    result.set(argv[i].slice(2), argv[i + 1]);
  }
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const values = args(process.argv.slice(2));
  if (values.has('apply-plan')) {
    const bytes = readFileSync(values.get('apply-plan'));
    const receipt = values.get('receipt');
    assert.ok(receipt && values.get('plan-sha256'), 'receipt_and_plan_hash_required');
    console.log(JSON.stringify(applyRetention(JSON.parse(bytes), { approvedHash: values.get('plan-sha256'), planBytes: bytes, receiptFile: receipt })));
  } else {
    const plan = planRetention({ deploymentRoot: values.get('deployment-root'), repoRoot: values.get('repo-root'), keepReleases: Number(values.get('keep-releases') ?? 4), protectedReleases: (values.get('protected-releases') ?? '').split(',').filter(Boolean) });
    const bytes = JSON.stringify(plan, null, 2);
    const report = values.get('report');
    assert.ok(report, 'plan_report_required');
    mkdirSync(dirname(report), { recursive: true });
    writeFileSync(report, bytes, { flag: 'wx' });
    console.log(JSON.stringify({ status: 'dry_run', plan_sha256: digest(bytes), removable_count: plan.removable.length, preserved_unknown_count: plan.preserved_unknown.length, protected_releases: plan.protected_releases }));
  }
}
