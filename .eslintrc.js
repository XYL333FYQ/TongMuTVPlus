const fs = require('fs');
const path = require('path');

// 依赖方向（docs/STANDARD.md S1）的待清理名单和结构检查共用一个文件，只能变短
const {
  imports: importAllowlist,
} = require('./scripts/structure-allowlist.json');

const features = fs
  .readdirSync(path.join(__dirname, 'src/features'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const DEEP_FEATURE_IMPORT = {
  group: ['@/features/*/**'],
  message: '功能之间只经对方的 index.ts 引用（docs/STANDARD.md S1）',
};

const importDirection = [
  {
    files: ['src/components/**', 'src/hooks/**', 'src/lib/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features', '@/features/**'],
              message:
                'components / hooks / lib 不能引用功能，需要的东西通过 props 或通用接口传入（docs/STANDARD.md S1）',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [DEEP_FEATURE_IMPORT] }],
    },
  },
  ...features.map((name) => ({
    files: [`src/features/${name}/**`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              ...DEEP_FEATURE_IMPORT,
              group: ['@/features/*/**', `!@/features/${name}/**`],
            },
          ],
        },
      ],
    },
  })),
  ...(importAllowlist.length
    ? [{ files: importAllowlist, rules: { 'no-restricted-imports': 'off' } }]
    : []),
];

module.exports = {
  // 第三方网盘检测脚本原样引入，不按本项目规则检查
  ignorePatterns: ['src/lib/pancheck/vendor/**'],
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  plugins: ['@typescript-eslint', 'simple-import-sort', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'next',
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    'no-unused-vars': 'off',
    'no-console': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'react/no-unescaped-entities': 'off',

    'react/display-name': 'off',
    'react/jsx-curly-brace-presence': [
      'warn',
      { props: 'never', children: 'never' },
    ],

    //#region  //*=========== Unused Import ===========
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
    //#endregion  //*======== Unused Import ===========

    //#region  //*=========== Import Sort ===========
    'simple-import-sort/exports': 'warn',
    'simple-import-sort/imports': [
      'warn',
      {
        groups: [
          // ext library & side effect imports
          ['^@?\\w', '^\\u0000'],
          // {s}css files
          ['^.+\\.s?css$'],
          // Lib and hooks
          ['^@/lib', '^@/hooks'],
          // static data
          ['^@/data'],
          // components
          ['^@/components', '^@/container'],
          // zustand store
          ['^@/store'],
          // Other imports
          ['^@/'],
          // relative paths up until 3 level
          [
            '^\\./?$',
            '^\\.(?!/?$)',
            '^\\.\\./?$',
            '^\\.\\.(?!/?$)',
            '^\\.\\./\\.\\./?$',
            '^\\.\\./\\.\\.(?!/?$)',
            '^\\.\\./\\.\\./\\.\\./?$',
            '^\\.\\./\\.\\./\\.\\.(?!/?$)',
          ],
          ['^@/types'],
          // other that didnt fit in
          ['^'],
        ],
      },
    ],
    //#endregion  //*======== Import Sort ===========
  },
  overrides: importDirection,
  globals: {
    React: true,
    JSX: true,
  },
};
