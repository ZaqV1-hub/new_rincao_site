import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { applyRetention, inspectRelease, planRetention } from './hml-release-retention.mjs';

function fixture(t) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'hml-retention-')));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const repo = join(base, 'repo');
  const root = join(base, 'hml');
  mkdirSync(join(root, 'releases'), { recursive: true });
  mkdirSync(join(repo, 'src'), { recursive: true });
  mkdirSync(join(repo, 'public', 'uploads'), { recursive: true });
  mkdirSync(join(repo, 'src', 'app', 'uploads'), { recursive: true });
  writeFileSync(join(repo, 'public', 'uploads', 'asset.txt'), 'immutable example asset');
  writeFileSync(join(repo, 'src', 'app', 'uploads', 'route.js'), 'export const example = true;');
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init');
  git('config', 'user.name', 'Pessoa Exemplo');
  git('config', 'user.email', 'example@tenant-demo.invalid');
  const ids = [];
  writeFileSync(join(repo, 'package.json'), '{"name":"app-example","private":true}');
  for (let i = 0; i < 8; i++) {
    writeFileSync(join(repo, 'src', 'main.js'), `export const version = ${i};\n`);
    git('add', '.');
    git('commit', '-m', `example release ${i}`);
    const id = git('rev-parse', 'HEAD');
    ids.push(id);
    const release = join(root, 'releases', id);
    mkdirSync(join(release, '.next'), { recursive: true });
    mkdirSync(join(release, 'node_modules'), { recursive: true });
    mkdirSync(join(release, 'src'), { recursive: true });
    mkdirSync(join(release, 'public', 'uploads'), { recursive: true });
    mkdirSync(join(release, 'src', 'app', 'uploads'), { recursive: true });
    copyFileSync(join(repo, 'public', 'uploads', 'asset.txt'), join(release, 'public', 'uploads', 'asset.txt'));
    copyFileSync(join(repo, 'src', 'app', 'uploads', 'route.js'), join(release, 'src', 'app', 'uploads', 'route.js'));
    copyFileSync(join(repo, 'src', 'main.js'), join(release, 'src', 'main.js'));
    copyFileSync(join(repo, 'package.json'), join(release, 'package.json'));
    writeFileSync(join(release, 'server.js'), 'require("next/dist/server/lib/start-server");');
    writeFileSync(join(release, '.next', 'BUILD_ID'), `build-example-${i}`);
    writeFileSync(join(release, 'node_modules', 'generated.bin'), `dependencies-${i}`);
    const time = new Date(Date.UTC(2020, 0, i + 1));
    utimesSync(release, time, time);
  }
  writeFileSync(join(root, 'current.txt'), `\uFEFF${join(root, 'releases', ids[0])}\r\n`);
  writeFileSync(join(root, 'previous.txt'), join(root, 'releases', ids[1]));
  const plan = () => planRetention({ deploymentRoot: root, repoRoot: repo });
  const apply = (reviewed = plan()) => {
    const bytes = JSON.stringify(reviewed, null, 2);
    return applyRetention(reviewed, { planBytes: bytes, approvedHash: createHash('sha256').update(bytes).digest('hex'), receiptFile: join(root, 'receipt.json') });
  };
  return { root, repo, ids, plan, apply, release: (i) => join(root, 'releases', ids[i]) };
}

test('dry run protects active and previous releases regardless of age and keeps four newest', (t) => {
  const f = fixture(t);
  const plan = f.plan();
  assert.deepEqual(new Set(plan.protected_releases), new Set([f.ids[0], f.ids[1], ...f.ids.slice(4)]));
  assert.deepEqual(new Set(plan.removable.map((r) => r.id)), new Set(f.ids.slice(2, 4)));
  for (const id of f.ids) assert.ok(existsSync(join(f.root, 'releases', id)));
  assert.ok(!existsSync(join(f.root, '.hml-retention.lock')));
});

test('actual removal writes a receipt and does not follow nested dependency links into outside storage', (t) => {
  const f = fixture(t);
  const outside = join(f.repo, 'persistent-storage');
  mkdirSync(outside);
  writeFileSync(join(outside, 'sentinel'), 'preserve');
  symlinkSync(outside, join(f.release(2), 'node_modules', 'external'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = f.apply();
  assert.equal(result.status, 'applied');
  assert.equal(result.removed.length, 2);
  assert.ok(!existsSync(f.release(2)) && !existsSync(f.release(3)));
  assert.ok(existsSync(f.release(0)) && existsSync(f.release(1)));
  assert.equal(readFileSync(join(outside, 'sentinel'), 'utf8'), 'preserve');
  assert.equal(JSON.parse(readFileSync(join(f.root, 'receipt.json'))).status, 'applied');
});

test('unknown and modified source files preserve their entire release', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.release(2), 'unknown-private-data.json'), '{}');
  const old = new Date(Date.UTC(2020, 0, 3));
  utimesSync(f.release(2), old, old);
  writeFileSync(join(f.release(3), 'src', 'main.js'), 'modified source');
  const plan = f.plan();
  assert.equal(plan.removable.length, 0);
  assert.deepEqual(new Set(plan.preserved_unknown.map((r) => r.reason)), new Set(['untracked_source_file', 'modified_source_file']));
  f.apply(plan);
  assert.ok(existsSync(f.release(2)) && existsSync(f.release(3)));
});

test('Windows checkout CRLF is accepted only when normalization exactly matches the Git blob; env files are preserved', (t) => {
  const f = fixture(t);
  const source = join(f.release(2), 'src', 'main.js');
  writeFileSync(source, readFileSync(source, 'utf8').replace(/\n/g, '\r\n'));
  assert.equal(inspectRelease(f.root, f.repo, f.ids[2]).verified, true);
  writeFileSync(join(f.release(3), '.env.local'), 'SYNTHETIC_SETTING=example');
  assert.equal(inspectRelease(f.root, f.repo, f.ids[3]).reason, 'persistent_or_environment_file_preserved');
  writeFileSync(source, 'different code\r\n');
  assert.equal(inspectRelease(f.root, f.repo, f.ids[2]).reason, 'modified_source_file');
});

test('bundled public assets require exact Git provenance and a new uploaded file preserves the entire release', (t) => {
  const f = fixture(t);
  assert.equal(inspectRelease(f.root, f.repo, f.ids[2]).verified, true);
  writeFileSync(join(f.release(2), 'public', 'uploads', 'new-private-file.txt'), 'synthetic untracked upload');
  assert.equal(inspectRelease(f.root, f.repo, f.ids[2]).reason, 'untracked_source_file');
  f.apply();
  assert.ok(existsSync(join(f.release(2), 'public', 'uploads', 'new-private-file.txt')));
});

test('a current pointer changed after review aborts before deletion and leaves a failure receipt', (t) => {
  const f = fixture(t);
  const plan = f.plan();
  writeFileSync(join(f.root, 'current.txt'), f.release(2));
  assert.throws(() => f.apply(plan), /retention_plan_changed/);
  assert.ok(existsSync(f.release(2)) && existsSync(f.release(3)));
  assert.equal(JSON.parse(readFileSync(join(f.root, 'receipt.json'))).status, 'failed');
  assert.ok(!existsSync(join(f.root, '.hml-retention.lock')));
});

test('an unknown file introduced after review invalidates the plan before any removal', (t) => {
  const f = fixture(t);
  const plan = f.plan();
  writeFileSync(join(f.release(2), 'unexpected.json'), '{}');
  assert.throws(() => f.apply(plan), /retention_plan_changed/);
  assert.ok(existsSync(f.release(2)) && existsSync(f.release(3)));
});

test('production roots and pointers outside releases are rejected', (t) => {
  const f = fixture(t);
  const production = join(f.root, '..', 'prod');
  mkdirSync(production);
  assert.throws(() => planRetention({ deploymentRoot: production, repoRoot: f.repo }), /hml_root_required/);
  writeFileSync(join(f.root, 'current.txt'), f.repo);
  assert.throws(() => f.plan(), /release_pointer_outside_root/);
});

test('an unrecognized release id or release root link is preserved', (t) => {
  const f = fixture(t);
  assert.equal(inspectRelease(f.root, f.repo, 'legacy-example').verified, false);
  rmSync(f.release(2), { recursive: true });
  symlinkSync(f.release(1), f.release(2), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(inspectRelease(f.root, f.repo, f.ids[2]).reason, 'release_link_forbidden');
  assert.ok(existsSync(f.release(1)));
});

test('a missing previous identity, wrong plan hash or competing cleanup lock prevents removal', (t) => {
  const f = fixture(t);
  const plan = f.plan();
  const bytes = JSON.stringify(plan);
  assert.throws(() => applyRetention(plan, { planBytes: bytes, approvedHash: 'invalid' }), /reviewed_plan_hash_mismatch/);
  writeFileSync(join(f.root, '.hml-retention.lock'), 'another operation');
  assert.throws(() => f.apply(plan), /EEXIST/);
  assert.equal(readFileSync(join(f.root, '.hml-retention.lock'), 'utf8'), 'another operation');
  rmSync(join(f.root, '.hml-retention.lock'));
  rmSync(join(f.root, 'previous.txt'));
  assert.throws(() => f.plan(), /previous_release_identity_required/);
  assert.ok(existsSync(f.release(2)) && existsSync(f.release(3)));
});
