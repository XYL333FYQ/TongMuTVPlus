// 控制字符（0x00–0x1F 里除了制表、换行、回车，再加 0x7F）：二进制内容和坏掉的 XML 里会出现。
// 按字符码判断，不写含控制字符的正则。

function isDisallowedControl(code: number, includeDelete: boolean): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false;
  return code <= 0x1f || (includeDelete && code === 0x7f);
}

/** 文本里有没有控制字符（不算 0x7F） */
export function hasControlChars(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (isDisallowedControl(text.charCodeAt(i), false)) return true;
  }
  return false;
}

/** 去掉 XML 不允许的控制字符（含 0x7F） */
export function stripXmlControlChars(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (!isDisallowedControl(text.charCodeAt(i), true)) out += text[i];
  }
  return out;
}
