// 流式过滤模型输出里的 <think>…</think> 思考内容。
// 模型的增量可能把标签拆开（如 "<thi" + "nk>…"），所以末尾疑似半个标签的部分
// 先留着，等下一段到了再判断；思考块内的文字一律丢弃。

const OPEN = '<think>';
const CLOSE = '</think>';

// buffer 末尾与 tag 开头重合的最长长度（可能是被拆开的半个标签）
function partialTagLength(buffer: string, tag: string): number {
  for (
    let length = Math.min(buffer.length, tag.length - 1);
    length > 0;
    length--
  ) {
    if (tag.startsWith(buffer.slice(-length))) return length;
  }
  return 0;
}

export interface ThinkFilter {
  // 送入一段增量，返回现在可以安全输出的文字
  push(text: string): string;
  // 流结束时调用，返回剩下可输出的文字（未闭合的思考块整体丢弃）
  flush(): string;
}

export function createThinkFilter(): ThinkFilter {
  let buffer = '';
  let inThink = false;

  return {
    push(text) {
      buffer += text;
      let output = '';
      for (;;) {
        if (!inThink) {
          const start = buffer.indexOf(OPEN);
          if (start >= 0) {
            output += buffer.slice(0, start);
            buffer = buffer.slice(start + OPEN.length);
            inThink = true;
            continue;
          }
          const hold = partialTagLength(buffer, OPEN);
          output += buffer.slice(0, buffer.length - hold);
          buffer = buffer.slice(buffer.length - hold);
          return output;
        }
        const end = buffer.indexOf(CLOSE);
        if (end >= 0) {
          buffer = buffer.slice(end + CLOSE.length);
          inThink = false;
          continue;
        }
        // 思考内容直接丢弃，只留可能是半个结束标签的尾巴
        buffer = buffer.slice(buffer.length - partialTagLength(buffer, CLOSE));
        return output;
      }
    },
    flush() {
      const rest = inThink ? '' : buffer;
      buffer = '';
      return rest;
    },
  };
}
