/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const prettier = require('prettier');

it('generates only project records and never copies historical versions into the project version', () => {
  const base = path.resolve(os.tmpdir());
  const workspace = fs.mkdtempSync(path.join(base, 'tongmutv-changelog-'));
  const script = path.resolve(__dirname, 'convert-changelog.js');
  try {
    fs.mkdirSync(path.join(workspace, 'src/lib'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'VERSION.txt'), '0.1.0');
    fs.writeFileSync(
      path.join(workspace, 'src/lib/brand.json'),
      JSON.stringify({ version: '0.1.0' })
    );
    fs.writeFileSync(
      path.join(workspace, 'CHANGELOG'),
      '## [226.1.0] - 2026-10-05\n### Added\n- Historical entry'
    );
    fs.writeFileSync(
      path.join(workspace, 'PROJECT_CHANGELOG'),
      '## [0.1.0] - 2026-10-24\n### Added\n- Project release'
    );
    const result = spawnSync(process.execPath, [script], {
      cwd: workspace,
      env: { ...process.env, GITHUB_ACTIONS: 'true' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(workspace, 'VERSION.txt'), 'utf8')).toBe(
      '0.1.0'
    );
    const generated = fs.readFileSync(
      path.join(workspace, 'src/lib/project-changelog.ts'),
      'utf8'
    );
    const projectFile = path.resolve(
      __dirname,
      '../src/lib/project-changelog.ts'
    );
    const formatted = prettier.format(generated, {
      ...prettier.resolveConfig.sync(projectFile),
      filepath: projectFile,
    });
    expect(generated).toBe(formatted);
    expect(generated).toContain('Project release');
    expect(generated).not.toContain('Historical entry');
    expect(generated).not.toContain('226.1.0');
    expect(fs.existsSync(path.join(workspace, 'src/lib/changelog.ts'))).toBe(
      false
    );
  } finally {
    if (path.dirname(path.resolve(workspace)) !== base) {
      throw new Error('Unexpected temporary workspace path');
    }
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
