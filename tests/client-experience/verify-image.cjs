const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function validateMetadata(run, jobs, repository, sha) {
  assert.equal(
    run.repository?.full_name,
    repository,
    'Image source belongs to another repository'
  );
  assert.equal(
    run.path,
    '.github/workflows/docker-image.yml',
    'Image did not use the verified build workflow'
  );
  assert.equal(run.status, 'completed', 'Image workflow is still running');
  assert.equal(run.conclusion, 'success', 'Image workflow did not pass');
  assert.equal(run.head_sha, sha, 'Image source SHA differs');
  for (const name of [
    'tag-policy',
    'checks / checks',
    'build (linux/amd64, ubuntu-latest)',
    'build (linux/arm64, ubuntu-24.04-arm)',
    'merge',
  ]) {
    assert(
      jobs.some((job) => job.name === name && job.conclusion === 'success'),
      'Missing successful image gate: ' + name
    );
  }
}

function main() {
  assert.equal(
    process.env.GITHUB_ACTIONS,
    'true',
    'Only use the disposable CI runner'
  );
  const sha = process.env.UI_SOURCE_SHA;
  const runId = process.env.UI_SOURCE_RUN;
  const digest = process.env.UI_IMAGE_DIGEST;
  assert(/^[0-9a-f]{40}$/.test(sha), 'Source SHA must be immutable');
  assert(/^[0-9]+$/.test(runId), 'Source run must be numeric');
  assert(
    /^sha256:[0-9a-f]{64}$/.test(digest),
    'Image must be pinned to a digest'
  );
  const repository = process.env.GITHUB_REPOSITORY;
  const api = (suffix) =>
    JSON.parse(
      execFileSync(
        'gh',
        ['api', 'repos/' + repository + '/actions/runs/' + runId + suffix],
        { encoding: 'utf8' }
      )
    );
  validateMetadata(api(''), api('/jobs?per_page=100').jobs, repository, sha);
  execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', sha], {
    stdio: 'inherit',
  });
  const sources = [
    'src',
    'public',
    'server',
    'scripts',
    'migrations',
    'Dockerfile',
    '.dockerignore',
    'docker-entrypoint.sh',
    'server.js',
    'start.js',
    'next.config.js',
    'tailwind.config.ts',
    'postcss.config.js',
    'tsconfig.json',
    'package.json',
    'pnpm-lock.yaml',
    'VERSION.txt',
  ];
  const objects = sources.map((source) => {
    const object = (revision) =>
      execFileSync('git', ['rev-parse', revision + ':' + source], {
        encoding: 'utf8',
      }).trim();
    const image = object(sha);
    assert.equal(
      object('HEAD'),
      image,
      'Runtime source differs from image: ' + source
    );
    return { path: source, object: image };
  });
  fs.writeFileSync(
    path.join(process.env.UI_ARTIFACT_DIR, 'image-provenance.json'),
    JSON.stringify(
      {
        sourceRun: runId,
        sourceSha: sha,
        digest,
        auditSha: process.env.GITHUB_SHA,
        objects,
        releaseEligible: false,
      },
      null,
      2
    )
  );
  console.log(
    'PASS: successful exact image source; runtime trees match; audit only'
  );
}

if (require.main === module) main();
module.exports = { validateMetadata };
