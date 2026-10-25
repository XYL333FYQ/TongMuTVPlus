#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const fs = require('fs');
const path = require('path');
const prettier = require('prettier');

function parseChangelog(content) {
  const versions = [];
  let current = null;
  let section = null;
  for (const line of content.split('\n')) {
    const text = line.trim();
    const version = text.match(
      /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/
    );
    if (version) {
      current = {
        version: version[1],
        date: version[2],
        added: [],
        changed: [],
        fixed: [],
      };
      versions.push(current);
      section = null;
    } else if (text.startsWith('### ')) {
      const category = text.slice(4).toLowerCase();
      section = ['added', 'changed', 'fixed'].includes(category)
        ? category
        : null;
    } else if (text.startsWith('## ')) {
      current = null;
      section = null;
    } else if (current && section && text.startsWith('- ')) {
      current[section].push(text.slice(2));
    }
  }
  return versions;
}

function main() {
  try {
    const root = process.cwd();
    const version = fs
      .readFileSync(path.join(root, 'VERSION.txt'), 'utf8')
      .trim();
    const brand = JSON.parse(
      fs.readFileSync(path.join(root, 'src/lib/brand.json'), 'utf8')
    );
    if (!/^\d+\.\d+\.\d+$/.test(version) || version !== brand.version) {
      throw new Error('VERSION.txt 必须与 TongMuTV Plus 品牌配置中的版本一致');
    }

    if (process.argv.includes('--sync-version')) {
      fs.writeFileSync(
        path.join(root, 'src/lib/version.ts'),
        "// TongMuTV Plus 的版本由品牌配置统一提供。\nexport { PROJECT_VERSION as CURRENT_VERSION } from './brand';\n"
      );
      console.log(`已同步 TongMuTV Plus 版本入口 v${version}`);
      return;
    }

    // 只读取本项目发布记录；根 CHANGELOG 是历史资料，不参与产品构建。
    const entries = parseChangelog(
      fs.readFileSync(path.join(root, 'PROJECT_CHANGELOG'), 'utf8')
    );
    const outputPath = path.join(root, 'src/lib/project-changelog.ts');
    const source = `// TongMuTV Plus 的发布记录；由 scripts/convert-changelog.js 从 PROJECT_CHANGELOG 生成。
export interface ChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
}

export const changelog: ChangelogEntry[] = ${JSON.stringify(entries, null, 2)};
`;
    const configPath = path.join(__dirname, '../src/lib/project-changelog.ts');
    const output = prettier.format(source, {
      ...prettier.resolveConfig.sync(configPath),
      filepath: outputPath,
    });
    fs.writeFileSync(outputPath, output);
    console.log(
      `已生成 TongMuTV Plus 发布记录，共 ${entries.length} 条；项目版本未改动`
    );
  } catch (error) {
    console.error('生成失败:', error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
