'use strict';
const { backup, argumentsFor } = require('./sqlite-maintenance.cjs');
async function main() {
  const options = argumentsFor(process.argv.slice(2));
  if (!options.output) throw new Error('Usage: node scripts/ops/sqlite-backup.cjs --db database.db --output new-backup.sqlite');
  process.stdout.write(`${JSON.stringify(await backup(options), null, 2)}\n`);
}
main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
