# Fixed SyncTV client assets

Protocol sources and OPAQUE WASM are copied from the official synctv-app tag
v1.1.32: https://github.com/synctv-org/synctv-app/tree/v1.1.32 .
The runtime server target is SyncTV v1.0.14.

The app Apache-2.0 license is preserved in LICENSE; the server MIT license is preserved in SERVER-LICENSE from the official v1.0.14 tag. Protocol files are
unaltered; manifest.json records SHA-256 of LF-normalized protocol sources and
the original WASM bytes. The generator emits only the transitive realtime
message/enum graph, preserving upstream field numbers and namespaces. Validation
annotations are removed from the generated schema, not from source files.

Run `pnpm gen:synctv` to regenerate the browser codec and manifest. Run
`pnpm test:together` for wire-format and bridge boundary checks.
The WASM is the upstream build, not an independently implemented password
protocol. Password-room integration and browser acceptance remain separate gates.
