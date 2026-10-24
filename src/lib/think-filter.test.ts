import { createThinkFilter } from './think-filter';

function run(chunks: string[]) {
  const filter = createThinkFilter();
  return chunks.map((chunk) => filter.push(chunk)).join('') + filter.flush();
}

test('removes a think block delivered in one piece', () => {
  expect(run(['<think>secret</think>answer'])).toBe('answer');
});

test('removes a think block whose opening tag is split across deltas', () => {
  expect(run(['<thi', 'nk>hidden reasoning</think>answer'])).toBe('answer');
});

test('removes a think block whose closing tag is split across deltas', () => {
  expect(run(['before <think>hidden</th', 'ink> after'])).toBe('before  after');
});

test('splits at every character still hide the reasoning', () => {
  const text = 'A<think>hidden</think>B<think>more</think>C';
  expect(run(text.split(''))).toBe('ABC');
});

test('ordinary text streams out immediately and a lone "<" is not lost', () => {
  const filter = createThinkFilter();
  expect(filter.push('hello ')).toBe('hello ');
  expect(filter.push('a <')).toBe('a ');
  expect(filter.push(' b')).toBe('< b');
  expect(filter.flush()).toBe('');
});

test('an unclosed think block at the end is dropped, a dangling partial tag is kept', () => {
  expect(run(['answer <think>never closed'])).toBe('answer ');
  expect(run(['math: 1 <thi'])).toBe('math: 1 <thi');
});
