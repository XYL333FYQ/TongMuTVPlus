import {
  SNOOZE_MS,
  detectClient,
  formatBuild,
  isOutdated,
  isSnoozed,
  snooze,
} from './client-update';

describe('detectClient', () => {
  it('普通浏览器、电视壳：不是客户端，什么都不提示', () => {
    expect(detectClient('Mozilla/5.0 Chrome/120', {})).toBeNull();
  });

  it('新版安卓壳：从 UA 读出构建时间', () => {
    expect(
      detectClient(
        'Mozilla/5.0 TongMuTVPlusAndroid WebView TMBuild/202610301530',
        {}
      )
    ).toEqual({ platform: 'android', build: '202610301530' });
  });

  it('旧版安卓壳：UA 里没有构建时间，按落后处理', () => {
    expect(detectClient('Mozilla/5.0 TongMuTVPlusAndroid WebView', {})).toEqual(
      {
        platform: 'android',
        build: null,
      }
    );
  });

  it('Windows 壳：新版有 TMDesktop.build，旧版没有', () => {
    expect(
      detectClient('Mozilla/5.0', {
        __tmDesktopInit: true,
        TMDesktop: { build: '202610301530' },
      })
    ).toEqual({ platform: 'windows', build: '202610301530' });
    expect(detectClient('Mozilla/5.0', { __tmDesktopInit: true })).toEqual({
      platform: 'windows',
      build: null,
    });
  });

  it('构建时间格式不对（如本地没填的 0）一律当作未知', () => {
    expect(
      detectClient('x', { __tmDesktopInit: true, TMDesktop: { build: '0' } })
    ).toEqual({ platform: 'windows', build: null });
  });
});

describe('isOutdated', () => {
  it('清单里的构建时间更新才算落后', () => {
    expect(isOutdated('202610301000', '202610301530')).toBe(true);
    expect(isOutdated('202610301530', '202610301530')).toBe(false);
    expect(isOutdated('202611010000', '202610301530')).toBe(false);
  });
  it('本机时间未知（旧版客户端）算落后', () => {
    expect(isOutdated(null, '202610301530')).toBe(true);
  });
  it('清单内容异常时不提示', () => {
    expect(isOutdated('202610301000', 'oops')).toBe(false);
  });
});

describe('稍后', () => {
  const store = () => {
    const data: Record<string, string> = {};
    return {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
    };
  };

  it('点稍后后，同一个新版本 3 天内不再弹，到期或出了更新的版本又弹', () => {
    const s = store();
    const now = 1_000_000;
    snooze(s, '202610301530', now);
    expect(isSnoozed(s, '202610301530', now + 1000)).toBe(true);
    expect(isSnoozed(s, '202610301530', now + SNOOZE_MS + 1)).toBe(false);
    expect(isSnoozed(s, '202611010000', now + 1000)).toBe(false);
  });

  it('存储里是坏数据时当作没有稍后', () => {
    expect(isSnoozed({ getItem: () => '{oops' }, '202610301530', 1)).toBe(
      false
    );
  });
});

describe('formatBuild', () => {
  it('把构建时间显示成年-月-日 时:分', () => {
    expect(formatBuild('202610301530')).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
    );
  });
});
