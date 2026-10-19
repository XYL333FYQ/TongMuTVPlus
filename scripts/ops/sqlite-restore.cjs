'use strict';
const { restore, argumentsFor } = require('./sqlite-maintenance.cjs');
try {
  const options = argumentsFor(process.argv.slice(2));
  if (!options.backupPath)
    throw new Error(
      'Usage: node scripts/ops/sqlite-restore.cjs --from backup.sqlite --db restore-target.db [--replace-existing --service-stopped]'
    );
  process.stdout.write(`${JSON.stringify(restore(options), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
