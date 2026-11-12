'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const SECRET_NAMES = [
  'SYNCTV_JWT_SECRET',
  'SYNCTV_SECURITY_OPAQUE_SERVER_SETUP_SECRET',
  'SYNCTV_SECURITY_CREDENTIAL_ENCRYPTION_KEY',
  'SYNCTV_SECURITY_TOTP_ENCRYPTION_KEY',
  'SYNCTV_SECURITY_EMAIL_OUTBOX_ENCRYPTION_KEY',
  'SYNCTV_SECURITY_PROXY_SIGNING_KEY',
  'SYNCTV_SECURITY_MEDIA_SWARM_SIGNING_KEY',
  'SYNCTV_SECURITY_PROVIDER_SESSION_ENCRYPTION_KEY',
  'SYNCTV_SECURITY_LOGIN_DISCOVERY_KEY',
  'SYNCTV_SECURITY_WEBAUTHN_ENUMERATION_KEY',
  'SYNCTV_FILE_UPLOAD_TOKEN_SECRET',
];
const random = () => crypto.randomBytes(32).toString('hex');
function create(file, content) {
  try {
    fs.writeFileSync(file, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  return fs.readFileSync(file, 'utf8');
}
function initializeTogetherSecrets(directory = path.resolve('.data')) {
  directory = path.resolve(directory);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const root = create(
    path.join(directory, 'synctv-root-password'),
    'Aa9' + random() + '\n'
  ).trim();
  if (!/^Aa9[a-f0-9]{64}$/.test(root))
    throw new Error('Inconsistent existing SyncTV root password');
  const postgres = create(
    path.join(directory, 'synctv-postgres.env'),
    'POSTGRES_USER=synctv\nPOSTGRES_DB=synctv\nPOSTGRES_PASSWORD=' +
      random() +
      '\n'
  );
  const password = postgres.match(/^POSTGRES_PASSWORD=([a-f0-9]{64})$/m)?.[1];
  if (
    !password ||
    !postgres.includes('POSTGRES_USER=synctv\n') ||
    !postgres.includes('POSTGRES_DB=synctv\n')
  )
    throw new Error('Inconsistent existing PostgreSQL credentials');
  const bridge =
    'SYNCTV_ADMIN_USERNAME=tongmu_bridge_admin\nSYNCTV_ADMIN_PASSWORD=' +
    root +
    '\n';
  if (create(path.join(directory, 'synctv-bridge.env'), bridge) !== bridge)
    throw new Error(
      'Inconsistent existing bridge credentials; restore matching secret files'
    );
  const database =
    'SYNCTV_DATABASE_URL=postgresql://synctv:' +
    password +
    '@synctv-postgres:5432/synctv';
  const upstream = create(
    path.join(directory, 'synctv.env'),
    database +
      '\n' +
      SECRET_NAMES.map((name) => name + '=' + random()).join('\n') +
      '\n'
  );
  if (
    !upstream.split('\n').includes(database) ||
    SECRET_NAMES.some(
      (name) => !new RegExp('^' + name + '=[a-f0-9]{64}$', 'm').test(upstream)
    )
  )
    throw new Error('Inconsistent existing SyncTV service secrets');
  return { directory };
}
if (require.main === module) {
  try {
    const result = initializeTogetherSecrets(process.argv[2]);
    console.log(
      'Together secret files ready in ' +
        result.directory +
        '. Back up this directory; no services started.'
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { initializeTogetherSecrets };
