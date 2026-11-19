// 极简 CSS 规则遍历：只为结构检查服务（选择器、声明、外层 @media）。
// 不处理 CSS 嵌套语法；本项目的样式文件都不用嵌套。

const GROUPING_AT_RULES = /^@(media|supports|container|layer|document)\b/i;

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' ')
  );
}

function matchingBrace(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length - 1;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

/** 返回 [{ selector, declarations: [{prop, value}], atRules: [...], line }] */
export function parseRules(source) {
  const text = stripComments(source);
  const rules = [];

  function walk(start, end, atRules) {
    let i = start;
    while (i < end) {
      const braceAt = text.indexOf('{', i);
      const semiAt = text.indexOf(';', i);
      if (braceAt === -1 || braceAt >= end) return;
      if (semiAt !== -1 && semiAt < braceAt) {
        // @import / @charset 之类的语句
        const statement = text.slice(i, semiAt).trim();
        if (statement.startsWith('@')) {
          i = semiAt + 1;
          continue;
        }
      }
      const rawPrelude = text.slice(i, braceAt);
      const prelude = rawPrelude.trim();
      const preludeStart =
        i + rawPrelude.length - rawPrelude.trimStart().length;
      const close = matchingBrace(text, braceAt);
      if (prelude.startsWith('@')) {
        if (GROUPING_AT_RULES.test(prelude)) {
          walk(braceAt + 1, close, [...atRules, prelude]);
        }
        // @keyframes / @font-face 等不含选择器规则
      } else if (prelude) {
        const body = text.slice(braceAt + 1, close);
        const declarations = body
          .split(';')
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => {
            const colon = part.indexOf(':');
            return colon === -1
              ? null
              : {
                  prop: part.slice(0, colon).trim(),
                  value: part.slice(colon + 1).trim(),
                };
          })
          .filter(Boolean);
        rules.push({
          selector: prelude.replace(/\s+/g, ' '),
          declarations,
          atRules,
          line: lineOf(text, preludeStart),
        });
      }
      i = close + 1;
    }
  }

  walk(0, text.length, []);
  return rules;
}

/** 按顶层逗号拆选择器列表 */
export function splitSelectorList(selector) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of selector) {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** 去掉括号里的内容（:not() / :where() / :has() / 属性选择器），只看主干 */
export function selectorSpine(selector) {
  let depth = 0;
  let out = '';
  for (const ch of selector) {
    if (ch === '(' || ch === '[') {
      depth += 1;
      continue;
    }
    if (ch === ')' || ch === ']') {
      depth -= 1;
      continue;
    }
    if (depth === 0) out += ch;
  }
  return out;
}

/** 主干里最靠右的 tm- 类名：这条规则实际在给谁定样式 */
export function subjectClass(selector) {
  const classes = selectorSpine(selector).match(/\.tm-[a-z0-9-]+/g);
  return classes ? classes[classes.length - 1].slice(1) : null;
}
