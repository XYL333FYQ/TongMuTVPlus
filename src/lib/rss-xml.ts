/**
 * xml2js 解析出来的 RSS：每个子元素都是数组，元素可能是纯文本，也可能是
 * `{ _: 文本, $: 属性 }`。ACG 磁力搜索和追番订阅都从这里取字段。
 */
export interface RssXmlNode {
  _?: string;
  $?: Record<string, string | undefined>;
  [child: string]: unknown;
}

/** 一条 <item>：标签名 → 节点数组 */
export type RssXmlItem = Record<string, Array<string | RssXmlNode> | undefined>;

/** 解析结果里我们会读到的部分 */
export interface RssXmlDocument {
  rss?: { channel?: Array<{ item?: RssXmlItem[] }> };
}

/**
 * 取第一个节点的文字：纯文本原样，元素取 `_`，没有就退到属性里的 url / href。
 * trim 为 false 时不去掉首尾空白（Nyaa、追番订阅一直是这样）。
 */
export function pickRssText(value: unknown, { trim = true } = {}): string {
  if (value === undefined || value === null) return '';
  const first: unknown = Array.isArray(value) ? value[0] : value;
  if (first === undefined || first === null) return '';
  const text =
    typeof first === 'object'
      ? String(
          (first as RssXmlNode)._ ??
            (first as RssXmlNode).$?.url ??
            (first as RssXmlNode).$?.href ??
            ''
        )
      : String(first);
  return trim ? text.trim() : text;
}

/** 第一个节点上的属性，例如 <enclosure url="..."> 的 url */
export function rssAttr(
  nodes: Array<string | RssXmlNode> | undefined,
  name: string
): string | undefined {
  const first = nodes?.[0];
  return typeof first === 'object' ? first.$?.[name] : undefined;
}

/** 第一个节点下的子元素，例如 Mikan 的 <torrent><pubDate> */
export function rssChild(
  nodes: Array<string | RssXmlNode> | undefined,
  name: string
): unknown {
  const first = nodes?.[0];
  return typeof first === 'object' ? first[name] : undefined;
}
