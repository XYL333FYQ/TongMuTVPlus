import { ExternalLink } from 'lucide-react';

/** 豆瓣代理等公共数据源的作者致谢（没有致谢信息的数据源返回 null） */
export function getDataSourceThanks(
  dataSource: string
): { text: string; url: string } | null {
  switch (dataSource) {
    case 'cors-proxy-zwei':
      return {
        text: 'Thanks to @Zwei',
        url: 'https://github.com/bestzwei',
      };
    case 'cmliussss-cdn-tencent':
    case 'cmliussss-cdn-ali':
      return {
        text: 'Thanks to @CMLiussss',
        url: 'https://github.com/cmliu',
      };
    default:
      return null;
  }
}

/** 数据源的致谢链接；账号菜单的设置和管理后台的站点设置共用 */
export function DataSourceThanks({ dataSource }: { dataSource: string }) {
  const info = getDataSourceThanks(dataSource);
  if (!info) return null;
  return (
    <div className='mt-3'>
      <button
        type='button'
        onClick={() => window.open(info.url, '_blank')}
        className='flex items-center justify-center gap-1.5 w-full px-3 text-[13px] text-muted cursor-pointer min-h-[44px] tm-press'
      >
        <span className='font-medium'>{info.text}</span>
        <ExternalLink className='w-3.5 opacity-70' />
      </button>
    </div>
  );
}
