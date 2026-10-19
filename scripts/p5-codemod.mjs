import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { scanText } from './check-design.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const palette =
  /^(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|slate|zinc|neutral|stone)-(\d{2,3})(?:\/(.+))?$/;
const colorKinds =
  /^(bg|text|border(?:-[xytrbl])?|ring(?:-offset)?|outline|decoration|shadow|divide|accent|caret|fill|stroke|from|via|to)-(.+)$/;
const libraryTokens = {
  paper: '--tm-bg',
  card: '--tm-surface',
  edge: '--tm-line',
  ink: '--tm-text',
  muted: '--tm-muted',
  chip: '--tm-room-player-text',
  ochre: '--tm-text',
  'ochre-hover': '--tm-text',
  'ochre-tint': '--tm-surface-raised',
  night: '--tm-bg',
  'night-card': '--tm-surface',
  'night-edge': '--tm-line',
  'night-ink': '--tm-text',
  'night-muted': '--tm-muted',
  'night-ochre': '--tm-text',
  'night-ochre-tint': '--tm-surface-raised',
};
const parse = (s, file) =>
  ts.createSourceFile(
    file,
    s,
    ts.ScriptTarget.Latest,
    true,
    /\.tsx?$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.JSX
  );
const literal = (n) =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
const q = (value, quote) =>
  quote +
  value
    .replace(/\\/g, '\\\\')
    .replaceAll(quote, `\\${quote}`)
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\$\{/g, quote === '`' ? '\\${' : '${') +
  quote;
const lineAt = (source, offset) => source.slice(0, offset).split('\n').length;

export function forbidden(file) {
  const p = relative(root, resolve(root, file)).replaceAll('\\', '/');
  return (
    p.startsWith('../') ||
    !p.startsWith('src/') ||
    /^(?:src\/app\/(?:api\/|admin\/)|src\/middleware\.|src\/hooks\/(?:useWatchRoom|usePlaySync)\.|src\/features\/playback\/(?:session\.|PlaybackSessionProvider\.)|server\/)/.test(
      p
    ) ||
    /(?:LegacyPlaybackSurface|\.db\.|\.(?:test|spec)\.)/.test(p)
  );
}
function splitVariants(token) {
  let depth = 0,
    last = -1;
  for (let i = 0; i < token.length; i++) {
    if (token[i] === '[' || token[i] === '(') depth++;
    else if (token[i] === ']' || token[i] === ')') depth--;
    else if (token[i] === ':' && depth === 0) last = i;
  }
  return [token.slice(0, last + 1), token.slice(last + 1)];
}
function mix(token, alpha, css = false) {
  if (!alpha) return css ? `var(${token})` : `var(${token})`;
  const number = Number(alpha.replace(/[\[\]]/g, ''));
  const percent = alpha.startsWith('[') ? number * 100 : number;
  if (!Number.isFinite(percent)) return null;
  const value = `color-mix(in srgb,var(${token}) ${percent}%,transparent)`;
  return css ? value : value.replaceAll(' ', '_');
}
function roleFor(n, sf, classText) {
  let owner = n;
  while (
    owner &&
    !ts.isJsxOpeningElement(owner) &&
    !ts.isJsxSelfClosingElement(owner) &&
    !ts.isPropertyAssignment(owner)
  )
    owner = owner.parent;
  const tag =
    owner &&
    (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner))
      ? owner.tagName.getText(sf)
      : '';
  const context = owner
    ? owner.parent.getText(sf).slice(0, 1400)
    : n.parent?.getText(sf) || '';
  const error =
    /\b(?:error|danger|destructive)\b|失败|错误/.test(context) &&
    !/warning|警告/.test(context);
  const main =
    /^(button|a|Link)$/.test(tag) &&
    (/(?:^|\s)(?:bg-(?:red|rose|blue|green|purple|indigo|emerald|orange|pink|cyan|sky|teal|violet|fuchsia)-[4-9]\d\d)\b/.test(
      classText
    ) ||
      (/(?:^|\s)bg-white(?:\s|$)/.test(classText) &&
        /(?:^|\s)text-black(?:\s|$)/.test(classText)) ||
      (/(?:^|\s)bg-black(?:\s|$)/.test(classText) &&
        /(?:^|\s)text-white(?:\s|$)/.test(classText)) ||
      /(?:^|\s)bg-library-(?:night-)?ochre(?:\/[^\s]+)?(?:\s|$)/.test(
        classText
      ));
  const page = /(?:min-h-screen|tm-page-container)/.test(classText);
  const raised =
    /\bbg-[a-z]+-(?:50|100|200)\b/.test(classText) ||
    /\bbg-white\//.test(classText);
  return { tag, error, main, page, raised, context, whole: classText };
}
function transformClasses(value, role, widths) {
  const todos = [];
  let count = 0;
  const result = value
    .split(/(\s+)/)
    .map((token) => {
      if (!token.trim()) return token;
      const [originalPrefix, utility] = splitVariants(token);
      if (/var\(--tm-/.test(utility)) return token;
      let prefix = originalPrefix
        .replace(/(?:^|:)dark:/, ':')
        .replace(/^:/, '');
      const mapped = (text) => {
        const next = text ? prefix + text : '';
        if (next !== token) count++;
        return next;
      };
      const small = utility.match(/^text-\[(\d*\.?\d+)(px|rem|em)\]$/);
      const font = (text) => {
        prefix = originalPrefix;
        return mapped(text);
      };
      const minimum = /(?:mtv-rate|tm-tv-card-rating|tm-poster-rating)/.test(
        role.whole
      )
        ? 12
        : 13;
      if (small && Number(small[1]) * (small[2] === 'px' ? 1 : 16) < minimum)
        return font(`text-[${minimum}px]`);
      if (utility === 'text-xs' && minimum === 13) return font('text-[13px]');
      if (/^font-(?:semibold|\[600\])$/.test(utility))
        return font(role.tag === 'h1' ? 'font-bold' : 'font-medium');
      if (/^font-(?:extrabold|black)$/.test(utility)) return font('font-bold');
      if (/^tracking-(?:tight|tighter|\[-[\d.]+(?:em|px|rem)\])$/.test(utility))
        return font('tracking-normal');
      if (utility === 'animate-pulse') return mapped('tm-skeleton');
      if (/^bg-gradient-/.test(utility))
        return mapped(
          role.page ? 'bg-[var(--tm-bg)]' : 'bg-[var(--tm-surface)]'
        );
      if (/gradient\(/.test(utility)) {
        todos.push('任意渐变需核对白名单和媒体可读性，保留待人工审查');
        return token;
      }
      const m = utility.match(colorKinds);
      if (!m) return token;
      const kind = m[1],
        color = m[2];
      const library = color.match(/^library-([a-z-]+)(?:\/(.+))?$/);
      if (library) {
        const name = library[1];
        let target = libraryTokens[name];
        if (!target) {
          todos.push(`未映射书库颜色 ${token}`);
          return token;
        }
        // Keep legitimate light/dark media-overlay alpha differences.
        prefix = originalPrefix;
        if (kind.startsWith('border') && !widths) return mapped('');
        if (kind === 'bg' && /^(?:night-)?ink$/.test(name))
          target = '--tm-room-cinema-bg';
        if (kind === 'text' && name === 'paper')
          target = /\bbg-library-(?:night-)?ochre(?:\s|$)/.test(role.whole)
            ? '--tm-accent-contrast'
            : '--tm-room-player-text';
        if (
          kind === 'text' &&
          name === 'night' &&
          /\bbg-library-(?:night-)?ochre(?:\s|$)/.test(role.whole)
        )
          target = '--tm-accent-contrast';
        if (kind === 'shadow') target = '--tm-room-cinema-bg';
        const alpha =
          kind.startsWith('border') || /muted/.test(name) ? null : library[2];
        const value = mix(target, alpha);
        if (!value) {
          todos.push(`未映射书库透明度 ${token}`);
          return token;
        }
        const typed =
          kind === 'text' || (kind === 'bg' && value.startsWith('color-mix'));
        return mapped(`${kind}-[${typed ? 'color:' : ''}${value}]`);
      }
      const match = color.match(palette);
      const mono = color.match(/^(white|black)(?:\/(.+))?$/);
      const hex = color.match(/^\[(?:color:)?(#[\da-fA-F]{3,8})\](?:\/(.+))?$/);
      if (!match && !mono && !hex) {
        if (
          /\[(?!.*(?:var\(|calc\(|length:|\d+(?:px|rem|em)|url\())[a-zA-Z]+\]/.test(
            color
          )
        )
          todos.push(`未映射任意颜色 ${token}`);
        return token;
      }
      const name = match?.[1] || mono?.[1] || 'hex';
      const shade = Number(match?.[2] || 0);
      const alpha = match?.[3] || mono?.[2] || hex?.[2];
      const colored = !!match && !/gray|slate|zinc|neutral|stone/.test(name);
      const isError = role.error && /red|rose/.test(name);
      let target = '--tm-text';
      if (kind === 'from' || kind === 'via' || kind === 'to') return mapped('');
      if (kind === 'bg') {
        if (name === 'black' && alpha) target = '--tm-room-cinema-bg';
        else if (role.main && ((colored && shade >= 400) || (mono && !alpha)))
          target = '--tm-text';
        else if (isError) target = '--tm-surface-raised';
        else if (role.page) target = '--tm-bg';
        else if (colored && alpha) target = '--tm-surface-raised';
        else if (colored && role.raised) target = '--tm-surface-raised';
        else if (colored)
          target =
            shade >= 400 &&
            !/\btext-white\b/.test(role.whole) &&
            !/(?:success|warning|badge|提示|成功|已上架|待处理)/.test(
              role.context
            )
              ? '--tm-text'
              : '--tm-surface-raised';
        else target = role.raised ? '--tm-surface-raised' : '--tm-surface';
        if (/hover:/.test(prefix) && role.main) return mapped('opacity-90');
        if (/hover:/.test(prefix)) target = '--tm-line';
        // Subtle neutral/colored states now use opaque semantic panels; masks keep alpha.
        const value = mix(target, name === 'black' ? alpha : null);
        return value
          ? mapped(
              `bg-[${value.startsWith('color-mix') ? 'color:' : ''}${value}]`
            )
          : token;
      }
      if (kind === 'text') {
        target = isError
          ? /^(?:div|p|span|section|h[1-6]|label|small)$/.test(role.tag)
            ? '--tm-text'
            : '--tm-danger'
          : (name === 'white' || name === 'black') &&
            (role.main ||
              /\bbg-library-(?:night-)?ochre(?:\s|$)/.test(role.whole))
          ? '--tm-accent-contrast'
          : !colored &&
            name !== 'white' &&
            name !== 'black' &&
            shade >= 300 &&
            shade <= 700
          ? '--tm-muted'
          : '--tm-text';
        if (/hover:/.test(prefix) && /^(a|Link)$/.test(role.tag))
          return mapped('opacity-80');
        return mapped(`text-[color:${mix(target, alpha)}]`);
      }
      if (kind.startsWith('border')) {
        // A color must not manufacture a visible border on a previously borderless element.
        if (!widths) return mapped('');
        target = isError ? '--tm-danger' : '--tm-line';
      } else if (kind === 'divide') target = '--tm-line';
      else if (kind === 'shadow') target = '--tm-room-cinema-bg';
      else target = isError ? '--tm-danger' : '--tm-text';
      return mapped(
        `${kind}-[${mix(target, kind.startsWith('border') ? null : alpha)}]`
      );
    })
    .join('');
  const compact = role.fragment
    ? result
    : [...new Set(result.trim().split(/\s+/).filter(Boolean))].join(' ');
  let next = compact;
  if (/\banimate-spin\b/.test(value))
    todos.push('原有加载转圈留待骨架动效阶段，不在本批改加载机制');
  if (
    role.main &&
    !role.fragment &&
    !/text-\[(?:color:)?var\(--tm-accent-contrast\)/.test(next)
  ) {
    next += ' text-[color:var(--tm-accent-contrast)]';
    count++;
  }
  if (/^(a|Link|button)$/.test(role.tag) && !/\bmin-h-\[44px\]/.test(value)) {
    next += ' min-h-[44px]';
    count++;
    if (
      role.tag === 'a' &&
      !/\b(?:inline-flex|flex|block|inline-block)\b/.test(value)
    ) {
      next += ' inline-flex items-center';
      count++;
    }
  }
  if (/^(a|Link|button)$/.test(role.tag) && !/\btm-press\b/.test(value)) {
    next += ' tm-press';
    count++;
  }
  return { value: next, count, todos };
}
function cssRole(property) {
  if (/danger|error/.test(property)) return '--tm-danger';
  if (/text.*(?:muted|soft|secondary)|(?:muted|secondary).*text/.test(property))
    return '--tm-muted';
  if (/text|^color$|caret|accent|primary|fill|stroke/.test(property))
    return '--tm-text';
  if (/border|outline|line/.test(property)) return '--tm-line';
  if (/overlay|shadow/.test(property)) return '--tm-room-cinema-bg';
  if (/surface.*soft|bg-secondary|raised|glass/.test(property))
    return '--tm-surface-raised';
  if (/surface|background-color|bg-strong/.test(property))
    return '--tm-surface';
  if (/background|(?:^|-)bg$/.test(property)) return '--tm-bg';
  return null;
}
function transformCss(source, file) {
  let count = 0;
  const todos = [];
  const lines = source.split('\n');
  let block = false;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (text.trim().startsWith('/*')) {
      if (!text.includes('*/')) block = true;
      continue;
    }
    if (block) {
      if (text.includes('*/')) block = false;
      continue;
    }
    const m = text.match(/^(\s*)([\w-]+)\s*:\s*(.+?)(;?\r?)$/);
    if (!m || m[2].startsWith('--tm-')) continue;
    const property = m[2];
    let value = m[3];
    const gradient = /(?:linear|radial|conic)-gradient\(/.test(value);
    const protectedTheme =
      /themes\.ts|books\/read|changelog|anime-subscription|email\./.test(file);
    if (gradient || protectedTheme) {
      if (
        /#[\da-fA-F]{3,8}\b|gradient\(/.test(value) &&
        !/TODO-P5/.test(lines[i - 1] || '')
      ) {
        const reason = gradient
          ? 'CSS 渐变需核对白名单和媒体可读性，保留待决定'
          : '独立主题或内容色无通用 token 映射，保留原值';
        todos.push({ file, line: i + 1, reason });
        lines[i] = `${m[1]}/* TODO-P5: ${reason} */\n${text}`;
      }
      continue;
    }
    const target = cssRole(property);
    if (target)
      value = value.replace(
        /#[\da-fA-F]{8}\b|#[\da-fA-F]{6}\b|#[\da-fA-F]{4}\b|#[\da-fA-F]{3}\b/g,
        () => {
          count++;
          return `var(${target})`;
        }
      );
    if (property === 'font-size')
      value = value.replace(/^(\d*\.?\d+)(px|rem|em)/, (s, n, unit) => {
        if (Number(n) * (unit === 'px' ? 1 : 16) >= 12) return s;
        count++;
        return '12px';
      });
    lines[i] = text.slice(0, m.index) + m[1] + property + ': ' + value + m[4];
  }
  return { source: lines.join('\n'), count, todos };
}

export function transform(source, file = 'fixture.tsx') {
  if (/\.css$/.test(file)) return transformCss(source, file);
  const sf = parse(source, file);
  const edits = new Map(),
    todos = [],
    declarations = new Map(),
    seen = new Set();
  let count = 0;
  const walk = (n, fn) => {
    fn(n);
    ts.forEachChild(n, (c) => walk(c, fn));
  };
  walk(sf, (n) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer
    ) {
      const previous = declarations.get(n.name.text);
      declarations.set(
        n.name.text,
        previous === undefined ? n.initializer : null
      );
    }
  });
  const edit = (start, end, value) =>
    edits.set(`${start}:${end}`, { start, end, value });
  function literalsIn(n, result = [], ids = new Set()) {
    if (!n) return result;
    if (literal(n) || ts.isTemplateExpression(n)) {
      result.push(n);
      if (ts.isTemplateExpression(n))
        n.templateSpans.forEach((s) => literalsIn(s.expression, result, ids));
    } else if (ts.isIdentifier(n) && !ids.has(n.text)) {
      ids.add(n.text);
      literalsIn(declarations.get(n.text), result, ids);
    } else if (ts.isConditionalExpression(n)) {
      literalsIn(n.whenTrue, result, ids);
      literalsIn(n.whenFalse, result, ids);
    } else if (ts.isBinaryExpression(n)) {
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(n.operatorToken.kind)
      )
        literalsIn(n.right, result, ids);
      else if (n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        literalsIn(n.left, result, ids);
        literalsIn(n.right, result, ids);
      }
    } else if (ts.isCallExpression(n)) {
      if (/^(?:clsx|cn|classNames)$/.test(n.expression.getText(sf)))
        n.arguments.forEach((a) => literalsIn(a, result, ids));
    } else if (ts.isObjectLiteralExpression(n))
      n.properties.forEach((p) => {
        if (ts.isPropertyAssignment(p) && literal(p.name)) result.push(p.name);
      });
    else if (ts.isArrayLiteralExpression(n))
      n.elements.forEach((a) => literalsIn(a, result, ids));
    else if (ts.isJsxExpression(n) || ts.isParenthesizedExpression(n))
      literalsIn(n.expression, result, ids);
    return result;
  }
  function todoNode(n, reason) {
    const start = n.getStart(sf),
      end = n.end;
    const line = lineAt(source, start);
    const prev = source.split('\n')[line - 2] || '';
    const current = source.split('\n')[line - 1] || '';
    if (/TODO-P5/.test(prev) || /TODO-P5/.test(current)) return;
    todos.push({ file, line, reason });
    const existing = edits.get(`${start}:${end}`);
    const value = existing?.value || source.slice(start, end);
    if (ts.isStringLiteral(n) && ts.isJsxAttribute(n.parent))
      edit(start, end, `{/* TODO-P5: ${reason} */ ${value}}`);
    else edit(start, start, `/* TODO-P5: ${reason} */ `);
  }
  function classes(n) {
    const items = literalsIn(n);
    const whole = items.map((x) => x.getText(sf)).join(' ');
    const widths =
      /(?:^|[\s'"`])(?:\w+:)*border(?:-[xytrbl])?(?:-[0248]|-\[\d[^\]]*\])?(?=[\s'"`]|$)/.test(
        whole
      );
    const role = roleFor(n, sf, whole);
    for (const item of items) {
      if (seen.has(item)) continue;
      seen.add(item);
      const fragments = ts.isTemplateExpression(item)
        ? [item.head, ...item.templateSpans.map((s) => s.literal)]
        : [item];
      for (const fragment of fragments) {
        const quote = source[fragment.getStart(sf)];
        const value = fragment.text;
        const localRole = roleFor(n, sf, value);
        const r = transformClasses(
          value,
          {
            ...localRole,
            fragment: ts.isTemplateExpression(item),
            tag: ts.isTemplateExpression(item) ? '' : role.tag,
          },
          widths
        );
        count += r.count;
        if (r.value !== value) {
          if (literal(fragment))
            edit(fragment.getStart(sf), fragment.end, q(r.value, quote));
          else {
            const a =
              fragment.getStart(sf) +
              (ts.isTemplateTail(fragment) || ts.isTemplateMiddle(fragment)
                ? 1
                : 1);
            const b = fragment.end - (ts.isTemplateTail(fragment) ? 1 : 2);
            edit(a, b, r.value);
          }
        }
        if (r.todos.length) todoNode(item, r.todos.join('；'));
      }
    }
  }
  function style(n) {
    if (!n) return;
    if (ts.isIdentifier(n)) return style(declarations.get(n.text));
    if (ts.isJsxExpression(n)) return style(n.expression);
    if (ts.isObjectLiteralExpression(n))
      for (const prop of n.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const property = prop.name.getText(sf).replace(/['"]/g, '');
        if (
          property === 'fontSize' &&
          ts.isNumericLiteral(prop.initializer) &&
          Number(prop.initializer.text) < 12
        ) {
          edit(prop.initializer.getStart(sf), prop.initializer.end, '12');
          count++;
        } else if (literal(prop.initializer)) {
          const old = prop.initializer.text,
            target = cssRole(property);
          if (/gradient\(/.test(old)) {
            todoNode(prop.initializer, '样式渐变需要核对白名单，保留原值');
            continue;
          }
          let next = target
            ? old.replace(
                /#[\da-fA-F]{8}\b|#[\da-fA-F]{6}\b|#[\da-fA-F]{4}\b|#[\da-fA-F]{3}\b/g,
                () => {
                  count++;
                  return `var(${target})`;
                }
              )
            : old;
          if (property === 'fontSize' && /^(\d*\.?\d+)(px|rem|em)$/.test(old)) {
            const [, num, unit] = old.match(/^(\d*\.?\d+)(px|rem|em)$/);
            if (Number(num) * (unit === 'px' ? 1 : 16) < 12) {
              next = '12px';
              count++;
            }
          }
          if (next !== old)
            edit(
              prop.initializer.getStart(sf),
              prop.initializer.end,
              q(next, source[prop.initializer.getStart(sf)])
            );
        }
      }
  }
  walk(sf, (n) => {
    if (ts.isJsxAttribute(n) && n.initializer) {
      if (n.name.text === 'className') classes(n.initializer);
      else if (n.name.text === 'style') style(n.initializer);
    }
    if (
      ts.isPropertyAssignment(n) &&
      n.name.getText(sf).replace(/['"]/g, '') === 'className'
    )
      classes(n.initializer);
  });
  // Leave non-style data (reader palettes, emails, media/Canvas colors) intact with precise local TODOs.
  const findings = scanText(source, file).filter((f) => !f.todo);
  for (const finding of findings) {
    const lineStart = source
      .split('\n')
      .slice(0, finding.line - 1)
      .reduce((v, s) => v + s.length + 1, 0);
    const pos = lineStart + finding.column - 1;
    let smallest = null;
    walk(sf, (n) => {
      if (
        (literal(n) || ts.isTemplateExpression(n)) &&
        n.getStart(sf) <= pos &&
        n.end >= pos &&
        (!smallest || n.end - n.pos < smallest.end - smallest.pos)
      )
        smallest = n;
    });
    if (
      smallest &&
      !seen.has(smallest) &&
      !edits.has(`${smallest.getStart(sf)}:${smallest.end}`)
    )
      todoNode(
        smallest,
        '非可证明的 className/样式值（内容、媒体或独立主题），保留原值'
      );
  }
  let next = source;
  const sorted = [...edits.values()].sort(
    (a, b) => b.start - a.start || b.end - a.end
  );
  let boundary = source.length;
  for (const e of sorted) {
    if (e.end > boundary)
      throw new Error(`重叠修改 ${file}:${lineAt(source, e.start)}`);
    next = next.slice(0, e.start) + e.value + next.slice(e.end);
    boundary = e.start;
  }
  // Input may already contain malformed legacy code. Never increase syntax diagnostics.
  if (parse(next, file).parseDiagnostics.length > sf.parseDiagnostics.length)
    throw new Error(`拒绝生成非法语法 ${file}`);
  return { source: next, count, todos };
}

/** Item 3 is an explicit exception: replace only the old outer wrapper, not its children. */
export function alignContainers(source, file) {
  const sf = parse(source, file),
    edits = [];
  let count = 0;
  function visit(n) {
    if (!ts.isJsxElement(n)) return ts.forEachChild(n, visit);
    const open = n.openingElement,
      name = open.tagName.getText(sf);
    const attr = open.attributes.properties.find(
      (p) =>
        ts.isJsxAttribute(p) &&
        p.name.text === 'className' &&
        p.initializer &&
        ts.isStringLiteral(p.initializer)
    );
    const withinShell =
      n.parent &&
      ts.isJsxElement(n.parent) &&
      /^(PageLayout|TVLayout)$/.test(
        n.parent.openingElement.tagName.getText(sf)
      );
    const isTop =
      !n.parent ||
      ts.isParenthesizedExpression(n.parent) ||
      ts.isReturnStatement(n.parent);
    const underBareMain =
      n.parent &&
      ts.isJsxElement(n.parent) &&
      n.parent.openingElement.tagName.getText(sf) === 'main' &&
      (ts.isParenthesizedExpression(n.parent.parent) ||
        ts.isReturnStatement(n.parent.parent));
    if (
      /^(main|div|section)$/.test(name) &&
      attr &&
      (withinShell || isTop || underBareMain) &&
      /(?:\bmax-w-|\bmx-auto|\bpx-|\bp-[0-9])/.test(attr.initializer.text)
    ) {
      const classes = attr.initializer.text
        .split(/\s+/)
        .flatMap((c) => {
          const [v, u] = splitVariants(c);
          if (u === 'container' || u === 'mx-auto' || /^max-w-|^px-/.test(u))
            return [];
          if (/^p-\d/.test(u)) return [v + u.replace(/^p-/, 'py-')];
          return [c];
        })
        .join(' ');
      edits.push(
        {
          start: open.tagName.getStart(sf),
          end: open.tagName.end,
          value: 'PageContainer',
        },
        {
          start: n.closingElement.tagName.getStart(sf),
          end: n.closingElement.tagName.end,
          value: 'PageContainer',
        },
        {
          start: attr.initializer.getStart(sf),
          end: attr.initializer.end,
          value: q(classes, source[attr.initializer.getStart(sf)]),
        }
      );
      count++;
      return;
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  if (!count) return { source, count: 0, todos: [] };
  if (!/import PageContainer from/.test(source)) {
    const last = sf.statements.filter(ts.isImportDeclaration).at(-1);
    const at = last?.end || 0;
    edits.push({
      start: at,
      end: at,
      value: "\nimport PageContainer from '@/components/PageContainer';",
    });
  }
  let next = source;
  for (const e of edits.sort((a, b) => b.start - a.start))
    next = next.slice(0, e.start) + e.value + next.slice(e.end);
  if (parse(next, file).parseDiagnostics.length > sf.parseDiagnostics.length)
    throw new Error(`容器语法失败 ${file}`);
  return { source: next, count, todos: [] };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2),
    write = args.includes('--write'),
    align = args.includes('--align');
  const paths = args.filter((p) => !p.startsWith('--'));
  if (
    args.some(
      (p) =>
        p.startsWith('--') && !['--write', '--dry-run', '--align'].includes(p)
    ) ||
    !paths.length ||
    (write && args.includes('--dry-run'))
  ) {
    console.error(
      '用法：node scripts/p5-codemod.mjs [--dry-run（默认）|--write] [--align（仅外层容器）] <具体文件路径...>'
    );
    process.exitCode = 2;
  } else {
    // Validate and compute the entire set before writing any file.
    try {
      const changes = paths.map((file) => {
        if (forbidden(file)) throw new Error(`禁区或非 src 文件：${file}`);
        const old = readFileSync(resolve(root, file), 'utf8');
        const result = align
          ? alignContainers(old, file)
          : transform(old, file);
        return { file, old, ...result };
      });
      for (const c of changes) {
        console.log(
          `${write ? 'WRITE' : 'DRY-RUN'} ${c.file}: 替换 ${c.count}；TODO ${
            c.todos.length
          }`
        );
        const a = c.old.split('\n'),
          b = c.source.split('\n');
        let samples = 0;
        for (let i = 0; i < Math.max(a.length, b.length) && samples < 6; i++)
          if (a[i] !== b[i]) {
            console.log(`@@ ${i + 1}\n- ${a[i] || ''}\n+ ${b[i] || ''}`);
            samples++;
          }
        for (const t of c.todos)
          console.log(`TODO ${c.file}:${t.line} ${t.reason}`);
        if (write && c.source !== c.old)
          writeFileSync(resolve(root, c.file), c.source);
      }
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
