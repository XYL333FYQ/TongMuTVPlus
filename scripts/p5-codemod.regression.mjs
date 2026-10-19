import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { transform, alignContainers, forbidden } from './p5-codemod.mjs';

const parse = (s) =>
  ts.createSourceFile(
    'fixture.tsx',
    s,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
function collect(source, predicate) {
  const result = [];
  const sf = parse(source);
  const visit = (n) => {
    if (predicate(n)) result.push(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return result;
}
function semantic(source) {
  const sf = parse(source);
  function walk(n) {
    if (ts.isJsxAttribute(n) && ['className', 'style'].includes(n.name.text))
      return null;
    if (ts.isJsxText(n) && !n.text.trim()) return null;
    if (
      [
        ts.SyntaxKind.CommaToken,
        ts.SyntaxKind.SemicolonToken,
        ts.SyntaxKind.OpenParenToken,
        ts.SyntaxKind.CloseParenToken,
      ].includes(n.kind)
    )
      return null;
    if (ts.isParenthesizedExpression(n)) return walk(n.expression);
    return [
      n.kind,
      ts.isIdentifier(n)
        ? n.text
        : ts.isStringLiteral(n) || ts.isJsxText(n)
        ? n.text.replace(/\s+/g, ' ').trim()
        : '',
      ...n
        .getChildren(sf)
        .filter((c) => c.kind !== ts.SyntaxKind.SyntaxList)
        .map(walk),
      ...n
        .getChildren(sf)
        .filter((c) => c.kind === ts.SyntaxKind.SyntaxList)
        .flatMap((c) => c.getChildren(sf).map(walk)),
    ].filter((x) => x !== null);
  }
  return JSON.stringify(walk(sf));
}
const baseline = (file) =>
  execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
const about = baseline('src/app/about/page.tsx');
const request = baseline('src/app/movie-request/page.tsx');
const transformed = transform(request, 'src/app/movie-request/page.tsx');
assert.equal(parse(transformed.source).parseDiagnostics.length, 0);
assert.equal(
  semantic(transformed.source),
  semantic(request),
  'non-style JSX/logic must stay identical'
);
// Problem 1: equal neutral styles must not collapse the original status condition.
const conditions = (s) =>
  collect(s, ts.isConditionalExpression).map((n) => n.condition.getText());
assert.deepEqual(conditions(transformed.source), conditions(request));
// Problems 2–6: each original element keeps exactly its original border/ring width classes.
const widths = (s) =>
  collect(s, ts.isJsxAttribute)
    .filter((n) => n.name.text === 'className')
    .map(
      (n) =>
        n
          .getText()
          .match(
            /\b(?:border(?:-[xytrbl])?(?:-[0248])?|ring(?:-[0248])?)\b(?![-\[])/g
          ) || []
    );
assert.deepEqual(widths(transformed.source), widths(request));
// Problem 7: both baseline links receive a genuine inline-flex 44px click area.
const aboutResult = transform(about, 'src/app/about/page.tsx');
const anchors = collect(aboutResult.source, ts.isJsxOpeningElement).filter(
  (n) => n.tagName.getText() === 'a'
);
assert.equal(anchors.length, 1);
assert.match(anchors[0].getText(), /inline-flex/);
assert.match(anchors[0].getText(), /min-h-\[44px\]/);
assert.equal(semantic(aboutResult.source), semantic(about));
// Problem 8: existing Prettier can format both outputs without a syntax/structure repair.
const prettier = (await import('prettier')).default;
for (const result of [aboutResult, transformed]) {
  const formatted = await prettier.format(result.source, {
    parser: 'typescript',
    singleQuote: true,
    jsxSingleQuote: true,
  });
  assert.equal(
    await prettier.check(formatted, {
      parser: 'typescript',
      singleQuote: true,
      jsxSingleQuote: true,
    }),
    true
  );
  const a = semantic(formatted),
    b = semantic(result.source);
  if (a !== b) {
    let i = 0;
    while (a[i] === b[i]) i++;
    throw new Error(
      `format AST mismatch at ${i}: ${a.slice(i - 100, i + 180)} / ${b.slice(
        i - 100,
        i + 180
      )}`
    );
  }
  assert.equal(
    transform(result.source, 'fixture.tsx').source,
    result.source,
    'idempotent'
  );
}
const fixture = `const width = 3; const untouched = '#12abcd'; const base = 'border-2'; const color = on ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'; export default () => <button onClick={act} className={clsx(base, color, {'border-green-600': on})} style={{color:'#ff0000', fontSize:10}} />;`;
const f = transform(fixture, 'fixture.tsx');
assert.equal(parse(f.source).parseDiagnostics.length, 0);
assert.deepEqual(conditions(f.source), conditions(fixture));
assert.match(f.source, /const untouched = .*'#12abcd'/);
assert.match(f.source, /fontSize:12/);
assert.equal(transform(f.source, 'fixture.tsx').source, f.source);
assert.match(
  transform(
    `const A = () => <div className='bg-[rebeccapurple]' />`,
    'fixture.tsx'
  ).source,
  /TODO-P5/
);
assert.equal(forbidden('src/hooks/useWatchRoom.ts'), true);
assert.equal(forbidden('src/app/api/test/route.ts'), true);
assert.equal(
  forbidden('src/features/playback/PlaybackSessionProvider.tsx'),
  true
);
const aligned = alignContainers(
  `import PageLayout from '@/components/PageLayout'; export default () => <PageLayout><main className='mx-auto max-w-3xl px-6 py-12'><p>same</p></main></PageLayout>`,
  'fixture.tsx'
);
assert.match(aligned.source, /<PageContainer className='py-12'>/);
assert.match(aligned.source, /<p>same<\/p>/);
assert.equal(
  alignContainers(aligned.source, 'fixture.tsx').source,
  aligned.source
);
const selectedFixture = `const Selected = () => <button className={selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} />;`;
const selectedResult = transform(selectedFixture, 'fixture.tsx');
const selectedBranch = collect(
  selectedResult.source,
  ts.isConditionalExpression
)[0];
assert.match(selectedBranch.whenTrue.getText(), /bg-\[var\(--tm-text\)\]/);
assert.match(selectedBranch.whenTrue.getText(), /--tm-accent-contrast/);
assert.doesNotMatch(selectedBranch.whenFalse.getText(), /--tm-accent-contrast/);
assert.match(selectedResult.source, /tm-press/);
// TV source selectors already use monochrome inversion; it must survive both themes.
for (const active of ['bg-white text-black', 'bg-black text-white']) {
  const input = `const TVSource = () => <button className={selected ? '${active}' : 'bg-white/10 text-white'} />;`;
  const output = transform(input, 'fixture.tsx');
  const branch = collect(output.source, ts.isConditionalExpression)[0];
  assert.match(branch.whenTrue.getText(), /bg-\[var\(--tm-text\)\]/);
  assert.match(branch.whenTrue.getText(), /--tm-accent-contrast/);
  assert.doesNotMatch(branch.whenFalse.getText(), /--tm-accent-contrast/);
  assert.deepEqual(conditions(output.source), conditions(input));
  assert.deepEqual(widths(output.source), widths(input));
  assert.equal(semantic(output.source), semantic(input));
  assert.equal(transform(output.source, 'fixture.tsx').source, output.source);
}
const monochromePanel = transform(
  `const Panel = () => <div className='bg-white text-black' />;`,
  'fixture.tsx'
);
assert.match(monochromePanel.source, /bg-\[var\(--tm-surface\)\]/);
assert.doesNotMatch(monochromePanel.source, /--tm-accent-contrast/);
const removedGradient = transform(
  `const Submit = () => <button className='bg-green-600 text-white hover:from-green-600 hover:to-blue-600' />;`,
  'fixture.tsx'
);
assert.doesNotMatch(
  removedGradient.source,
  /(?:^|\s)(?:hover|dark|focus):(?=\s|['"`])/
);
assert.equal(
  transform(removedGradient.source, 'fixture.tsx').source,
  removedGradient.source
);
const warningPair = transform(
  `const WarningPair = () => <p className='bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'>没有采集源</p>`,
  'fixture.tsx'
);
assert.match(warningPair.source, /bg-\[var\(--tm-surface-raised\)\]/);
assert.doesNotMatch(warningPair.source, /bg-\[var\(--tm-text\)\]/);
const errorPanel = transform(
  `const ErrorPanel = () => error ? <div className='border border-red-500/40 bg-red-950/40 text-red-100'>{error}</div> : null;`,
  'fixture.tsx'
);
assert.match(errorPanel.source, /bg-\[var\(--tm-surface-raised\)\]/);
// D92D20 on the dark raised panel is only 3.53:1: retain red on the border, use readable body text.
assert.match(errorPanel.source, /text-\[color:var\(--tm-text\)\]/);
const errorIcon = transform(
  `const ErrorIcon = () => error ? <AlertTriangle className='text-red-500' /> : null;`,
  'fixture.tsx'
);
assert.match(errorIcon.source, /text-\[color:var\(--tm-danger\)\]/);
const translucentBadge = transform(
  `const LoginBadge = () => <div className='bg-emerald-500/15 text-emerald-200'>已登录电视端</div>;`,
  'fixture.tsx'
);
assert.match(translucentBadge.source, /bg-\[var\(--tm-surface-raised\)\]/);
assert.match(translucentBadge.source, /text-\[color:var\(--tm-text\)\]/);
const customGradient = transform(
  `const Ambient = () => <div className='bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.35),transparent_34%)]' />;`,
  'fixture.tsx'
);
assert.match(customGradient.source, /TODO-P5/);
const libraryPanel = transform(
  `const Library = () => <article className='bg-library-card dark:bg-library-night-card text-library-ink dark:text-library-night-ink border border-library-edge'><button className='bg-library-ochre text-white hover:bg-library-ochre-hover'>打开</button></article>;`,
  'fixture.tsx'
);
assert.doesNotMatch(libraryPanel.source, /(?:bg|text|border)-library-/);
assert.match(libraryPanel.source, /bg-\[var\(--tm-surface\)\]/);
assert.match(libraryPanel.source, /--tm-accent-contrast/);
assert.equal(
  transform(libraryPanel.source, 'fixture.tsx').source,
  libraryPanel.source
);
const libraryBadge = transform(
  `const Count = () => <span className='bg-library-ochre text-white dark:bg-library-night-ochre dark:text-library-night'>+3</span>;`,
  'fixture.tsx'
);
assert.match(libraryBadge.source, /text-\[color:var\(--tm-accent-contrast\)\]/);
assert.doesNotMatch(libraryBadge.source, /text-\[color:var\(--tm-text\)\]/);
const libraryAccentLabel = transform(
  `const New = () => <span className='bg-library-ochre text-library-paper'>更新</span>;`,
  'fixture.tsx'
);
assert.match(
  libraryAccentLabel.source,
  /text-\[color:var\(--tm-accent-contrast\)\]/
);
const typography = transform(
  `const Labels = () => <section><p className='text-xs font-semibold tracking-tight'>说明</p><span className='text-[11px]'>文字</span><span className='tm-tv-card-rating text-[11px] font-semibold'>7.2</span><i className='animate-pulse' /></section>;`,
  'fixture.tsx'
);
assert.match(typography.source, /text-\[13px\]/);
assert.match(typography.source, /tm-tv-card-rating text-\[12px\] font-medium/);
assert.doesNotMatch(
  typography.source,
  /text-xs|font-semibold|tracking-tight|animate-pulse/
);
assert.match(typography.source, /tracking-normal/);
assert.match(typography.source, /tm-skeleton/);
assert.equal(
  transform(typography.source, 'fixture.tsx').source,
  typography.source
);
assert.match(
  transform(
    `const Warning = () => <main className='min-h-screen bg-gradient-to-br from-red-50 to-orange-50' />`,
    'fixture.tsx'
  ).source,
  /bg-\[var\(--tm-bg\)\]/
);
assert.match(
  transform(
    `const Spinner = () => <i className='animate-spin' />`,
    'fixture.tsx'
  ).source,
  /TODO-P5/
);
console.log(
  'P5 regression PASS: 8 pilot problems, logic/JSX, clsx, hex, fontsize, TODO, idempotence, forbidden paths, containers'
);
