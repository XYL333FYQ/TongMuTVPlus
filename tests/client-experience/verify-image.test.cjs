const assert = require('node:assert/strict');
const test = require('node:test');
const { validateMetadata } = require('./verify-image.cjs');
const repository = 'owner/project';
const sha = 'a'.repeat(40);
const source = {
  repository: { full_name: repository },
  path: '.github/workflows/docker-image.yml',
  status: 'completed',
  conclusion: 'success',
  head_sha: sha,
};
const jobs = [
  'tag-policy',
  'checks / checks',
  'build (linux/amd64, ubuntu-latest)',
  'build (linux/arm64, ubuntu-24.04-arm)',
  'merge',
].map((name) => ({ name, conclusion: 'success' }));
test('successful exact source and both architectures are accepted', () => {
  assert.doesNotThrow(() => validateMetadata(source, jobs, repository, sha));
});
for (const [label, change] of [
  ['different repository', { repository: { full_name: 'other/project' } }],
  ['other workflow', { path: '.github/workflows/other.yml' }],
  ['unfinished run', { status: 'in_progress' }],
  ['failed checks', { conclusion: 'failure' }],
  ['different source', { head_sha: 'b'.repeat(40) }],
]) {
  test('rejects ' + label, () => {
    assert.throws(() =>
      validateMetadata({ ...source, ...change }, jobs, repository, sha)
    );
  });
}
for (const name of jobs.map((job) => job.name)) {
  test('requires successful ' + name, () => {
    assert.throws(() =>
      validateMetadata(
        source,
        jobs.filter((job) => job.name !== name),
        repository,
        sha
      )
    );
    assert.throws(() =>
      validateMetadata(
        source,
        jobs.map((job) =>
          job.name === name ? { ...job, conclusion: 'failure' } : job
        ),
        repository,
        sha
      )
    );
  });
}
