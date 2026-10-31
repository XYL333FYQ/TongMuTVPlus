const assert = require('node:assert/strict');
const test = require('node:test');
const { imageTags } = require('./docker-image-tags.cjs');

const sha = 'a'.repeat(40);
const input = {
  repository: 'ghcr.io/owner/tongmutvplus',
  version: '0.1.1',
  sha,
  tag: 'latest',
  isDefaultBranch: false,
};

test('branch builds cannot replace latest or the official version tag', () => {
  assert.deepEqual(imageTags(input), [
    `${input.repository}:client-audit-${sha}`,
  ]);
  assert.throws(() => imageTags({ ...input, tag: 'v0.1.1' }), /client-audit/);
});

test('a named client audit build also retains its immutable commit tag', () => {
  assert.deepEqual(imageTags({ ...input, tag: 'client-audit-preview' }), [
    `${input.repository}:client-audit-preview`,
    `${input.repository}:client-audit-${sha}`,
  ]);
});

test('default branch retains release aliases and an immutable rollback tag', () => {
  assert.deepEqual(imageTags({ ...input, isDefaultBranch: true }), [
    `${input.repository}:latest`,
    `${input.repository}:v0.1.1`,
    `${input.repository}:sha-${sha}`,
  ]);
});

test('invalid tag, repository and commit input cannot enter shell arguments', () => {
  assert.throws(
    () => imageTags({ ...input, tag: 'client-audit-x;echo bad' }),
    /tag/
  );
  assert.throws(
    () => imageTags({ ...input, repository: 'image name' }),
    /repository/
  );
  assert.throws(() => imageTags({ ...input, sha: 'main' }), /commit/);
  assert.throws(() => imageTags({ ...input, version: '' }), /version/);
});
