const TAG = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;

function imageTags({
  repository,
  version,
  sha,
  tag = 'latest',
  isDefaultBranch,
}) {
  if (!/^[a-z0-9][a-z0-9./_-]*$/.test(repository || ''))
    throw new Error('Invalid image repository');
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Invalid commit SHA');
  if (!TAG.test(tag)) throw new Error('Invalid image tag');
  if (typeof version !== 'string' || !version || !TAG.test(`v${version}`))
    throw new Error('Invalid version tag');
  if (isDefaultBranch)
    return [
      ...new Set([
        `${repository}:${tag}`,
        `${repository}:v${version}`,
        `${repository}:sha-${sha}`,
      ]),
    ];
  if (tag !== 'latest' && !tag.startsWith('client-audit-'))
    throw new Error('Branch image tag must start with client-audit-');
  return [
    ...new Set([
      ...(tag === 'latest' ? [] : [`${repository}:${tag}`]),
      `${repository}:client-audit-${sha}`,
    ]),
  ];
}

module.exports = { imageTags };
if (require.main === module) {
  const env = process.env;
  for (const tag of imageTags({
    repository: env.IMAGE_REPOSITORY,
    version: env.IMAGE_VERSION,
    sha: env.COMMIT_SHA,
    tag: env.IMAGE_TAG || 'latest',
    isDefaultBranch: env.IS_DEFAULT_BRANCH === 'true',
  }))
    process.stdout.write(tag + '\n');
}
