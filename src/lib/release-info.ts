import { z } from 'zod';

import { PROJECT_VERSION } from '@/lib/brand';
import { changelog } from '@/lib/project-changelog';

const version = z
  .string()
  .trim()
  .regex(
    /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/,
    '版本号请填写三段数字，例如 0.1.1'
  );
const lines = z
  .array(
    z.string().trim().min(1, '记录不能只有空白').max(500, '每条记录最多 500 字')
  )
  .max(30, '每类最多 30 条记录');
const entry = z
  .object({
    version,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式为 YYYY-MM-DD')
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return (
          !Number.isNaN(date.getTime()) &&
          date.toISOString().slice(0, 10) === value
        );
      }, '请填写有效日期'),
    added: lines,
    changed: lines,
    fixed: lines,
  })
  .refine(
    (value) =>
      value.added.length + value.changed.length + value.fixed.length > 0,
    '每个版本至少填写一条发布记录'
  );

const schema = z
  .object({
    version,
    entries: z
      .array(entry)
      .min(1, '至少保留一个版本')
      .max(50, '最多保留 50 个版本'),
  })
  .superRefine((value, context) => {
    if (value.entries[0]?.version !== value.version)
      context.addIssue({
        code: 'custom',
        message: '当前版本必须与第一条发布记录的版本一致',
      });
    if (
      new Set(value.entries.map((item) => item.version)).size !==
      value.entries.length
    )
      context.addIssue({ code: 'custom', message: '发布记录的版本号不能重复' });
  });

export type ReleaseInfo = z.infer<typeof schema>;
export const defaultReleaseInfo: ReleaseInfo = {
  version: PROJECT_VERSION,
  entries: changelog,
};

export function parseReleaseInfo(value: unknown): ReleaseInfo {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues[0].message);
  return result.data;
}

export function resolveReleaseInfo(value: unknown): ReleaseInfo {
  const result = schema.safeParse(value);
  return result.success ? result.data : defaultReleaseInfo;
}
