import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * 服务器上真正的 Node require（从项目根目录解析模块），不经打包器：
 * 用来按需加载可选依赖、给书源 / 音源脚本用。只能在 nodejs 运行时的服务器代码里引入。
 */
export const nodeRequire: NodeRequire = createRequire(
  path.join(process.cwd(), 'package.json')
);
