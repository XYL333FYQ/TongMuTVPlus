'use client';

import ModalLayer from '@/components/feedback/ModalLayer';
import Select from '@/components/ui/Select';

export type DownloadTool = 'aria2' | 'Transmission' | 'qBittorrent';

export const DOWNLOAD_TOOL_OPTIONS: Array<{
  value: DownloadTool;
  label: string;
}> = [
  { value: 'aria2', label: 'aria2' },
  { value: 'qBittorrent', label: 'qBittorrent' },
  { value: 'Transmission', label: 'Transmission' },
];

/**
 * 离线下载前给资源起名、选下载工具（ACG 磁力搜索和网盘搜索共用）。
 * 放在公共弹窗层里：Esc / 返回键 / 点遮罩等于取消。
 */
export function OfflineDownloadNameDialog({
  name,
  onNameChange,
  tool,
  onToolChange,
  onCancel,
  onConfirm,
}: {
  name: string;
  onNameChange: (name: string) => void;
  tool: DownloadTool;
  onToolChange: (tool: DownloadTool) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalLayer variant='panel' label='设置资源名称' onClose={onCancel}>
      <div className='bg-surface rounded-lg p-6 w-full'>
        <h3 className='text-lg font-medium text-fg mb-4'>设置资源名称</h3>
        <input
          type='text'
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder='请输入资源名称'
          className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-fg'
          autoFocus
        />
        <label className='mt-4 block text-sm font-medium text-muted'>
          下载方式
        </label>
        <Select
          value={tool}
          onChange={(e) => onToolChange(e.target.value as DownloadTool)}
          className='mt-1 w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-fg'
        >
          {DOWNLOAD_TOOL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <div className='mt-4 flex gap-2 justify-end'>
          <button
            onClick={onCancel}
            className='px-4 py-2 rounded-lg bg-raised text-muted hover:bg-line transition-colors min-h-[44px] tm-press'
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!name.trim()}
            className='px-4 py-2 rounded-lg bg-fg text-inverse hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] tm-press'
          >
            确定
          </button>
        </div>
      </div>
    </ModalLayer>
  );
}
