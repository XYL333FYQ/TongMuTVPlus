const fs = require('fs');
const P = process.argv[2];
class DCLogic { constructor() { this.props = {}; this.state = undefined; } setState() {} }
function lookup(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function fill(tpl, scope) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, p) => { const v = lookup(scope, p); return v == null || typeof v === 'function' ? '' : String(v); });
}
function render(file, props, state) {
  const src = fs.readFileSync(`${P}/${file}`, 'utf8');
  const markup = src.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
  const script = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const helmet = (markup.match(/<helmet>([\s\S]*?)<\/helmet>/) || [0, ''])[1];
  let body = markup.replace(/<helmet>[\s\S]*?<\/helmet>/, '').replace(/\s+onClick="\{\{[\w.]+\}\}"/g, '');
  const Component = new Function('DCLogic', script + '; return Component;')(DCLogic);
  const inst = new Component(); inst.props = props; inst.state = state;
  const vals = inst.renderVals();
  body = body.replace(/<sc-for\s+list="\{\{([\w.]+)\}\}"\s+as="(\w+)"[^>]*>([\s\S]*?)<\/sc-for>/g, (m, list, as, inner) => (lookup(vals, list) || []).map((it) => fill(inner, { ...vals, [as]: it })).join(''));
  body = fill(body, vals);
  const title = (src.match(/<title>([^<]*)<\/title>/) || [0, file])[1];
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n${helmet}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}
const jobs = [
  ['Main.dc.html', 'home-desktop', { dark: true }, undefined, { dark: false }],
  ['Phone.dc.html', 'home-phone'], ['Room.dc.html', 'room-desktop'], ['RoomPhone.dc.html', 'room-phone'],
  ['Detail.dc.html', 'detail-desktop'], ['DetailPhone.dc.html', 'detail-phone'], ['ChooseRoom.dc.html', 'choose-room-phone'],
];
for (const j of jobs) {
  const [file, name] = j;
  if (name === 'home-desktop') {
    fs.writeFileSync(`${name}-dark.html`, render(file, {}, { dark: true }));
    fs.writeFileSync(`${name}-light.html`, render(file, {}, { dark: false }));
  } else {
    fs.writeFileSync(`${name}-dark.html`, render(file, { dark: true }));
    fs.writeFileSync(`${name}-light.html`, render(file, { dark: false }));
  }
}
fs.writeFileSync('detail-desktop-series-dark.html', render('Detail.dc.html', { dark: true, series: true }));
console.log('built');
