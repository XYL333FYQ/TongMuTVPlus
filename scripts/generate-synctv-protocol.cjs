'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  crypto = require('node:crypto');
const protobuf = require('protobufjs');
const { pbjs, pbts } = require('protobufjs-cli');
const base = path.resolve(__dirname, '..'),
  vendor = path.join(base, 'vendor/synctv'),
  dest = path.join(base, 'src/features/rooms/synctv/protocol');
const root = new protobuf.Root();
root.resolvePath = (origin, target) => {
  const local = path.resolve(
    vendor,
    target.startsWith('proto/')
      ? target
      : path.join(path.dirname(path.relative(vendor, origin || vendor)), target)
  );
  if (fs.existsSync(local)) return local;
  if (target.startsWith('google/'))
    return require.resolve('protobufjs/' + target);
  return path.resolve(vendor, target);
};
root.loadSync(path.join(vendor, 'proto/client.proto'));
root.resolveAll();
const visited = new Set(),
  schema = { nested: {} };
function include(type) {
  if (!type || visited.has(type.fullName)) return;
  visited.add(type.fullName);
  if (type.fieldsArray)
    for (const field of type.fieldsArray) include(field.resolvedType);
  const parts = type.fullName.slice(1).split('.');
  let parent = schema;
  for (const part of parts.slice(0, -1)) {
    parent.nested ||= {};
    parent.nested[part] ||= { nested: {} };
    parent = parent.nested[part];
  }
  parent.nested ||= {};
  parent.nested[parts.at(-1)] = type.toJSON();
}
include(root.lookupType('synctv.client.ClientMessage'));
include(root.lookupType('synctv.client.ServerMessage'));
function strip(value) {
  if (!value || typeof value !== 'object') return;
  delete value.options;
  delete value.comment;
  for (const child of Object.values(value)) strip(child);
}
strip(schema);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tongmu-proto-'));
fs.mkdirSync(dest, { recursive: true });
const json = path.join(temp, 'protocol.json');
fs.writeFileSync(json, JSON.stringify(schema));
const js = path.join(dest, 'client.js'),
  dts = path.join(dest, 'client.d.ts');
const run = (tool, args) =>
  new Promise((resolve, reject) =>
    tool.main(args, (error, output) =>
      error ? reject(error) : resolve(output)
    )
  );
(async () => {
  try {
    await run(pbjs, [
      '-t',
      'static-module',
      '-w',
      'commonjs',
      '--no-create',
      '--no-convert',
      '--no-verify',
      '--no-delimited',
      '--no-service',
      '--root',
      'tongmu_synctv_1_0_14',
      '-o',
      js,
      json,
    ]);
    await run(pbts, ['--no-comments', '-o', dts, js]);
    // pbts requires pbjs JSDoc, even when declaration comments are omitted.
    // Reuse the runtime's structural Long interface; do not require a new direct dependency.
    fs.writeFileSync(
      dts,
      fs
        .readFileSync(dts, 'utf8')
        .replace(
          'import Long = require("long");',
          'type Long = $protobuf.Long;'
        )
    );
    const header =
      '// Generated from SyncTV Server v1.0.14 / App v1.1.32; DO NOT EDIT.\n// Upstream license: vendor/synctv/LICENSE. Regenerate: pnpm gen:synctv.\n';
    for (const file of [js, dts])
      fs.writeFileSync(file, header + fs.readFileSync(file, 'utf8'));
    const files = {};
    function hashes(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, e.name);
        if (e.isDirectory()) hashes(file);
        else if (e.name.endsWith('.proto'))
          files[path.relative(vendor, file).replaceAll('\\', '/')] = crypto
            .createHash('sha256')
            .update(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'))
            .digest('hex');
      }
    }
    hashes(path.join(vendor, 'proto'));
    fs.writeFileSync(
      path.join(vendor, 'manifest.json'),
      JSON.stringify(
        {
          server: 'v1.0.14',
          app: 'v1.1.32',
          source: 'https://github.com/synctv-org/synctv-app/tree/v1.1.32',
          wasmSha256: crypto
            .createHash('sha256')
            .update(
              fs.readFileSync(
                path.join(base, 'public/synctv/opaque-v1.1.32.wasm')
              )
            )
            .digest('hex'),
          files,
        },
        null,
        2
      ) + '\n'
    );
    console.log(
      'Generated ' + visited.size + ' upstream realtime message/enum types.'
    );
  } finally {
    if (
      path.dirname(path.resolve(temp)) !== path.resolve(os.tmpdir()) ||
      !path.basename(temp).startsWith('tongmu-proto-')
    )
      throw new Error('Unsafe temporary output path');
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
