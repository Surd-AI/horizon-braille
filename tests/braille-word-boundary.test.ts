import {expect, test} from 'vitest';
import {analyzeChineseDetailed} from '../packages/core/src/language/chinese';

const words = (source: string, boundaries: {start:number;end:number}[] = []) =>
  analyzeChineseDetailed(source, [], 0, undefined, boundaries).words
    .filter(word => word.kind === 'chinese').map(word => word.raw);

test('盲文 remains one editable word in the immediate ICU result', () => {
  expect(words('盲文转换')).toEqual(['盲文', '转换']);
  expect(words('请把文字转换成盲文。').at(-1)).toBe('盲文');
});

test('a split external proposal cannot regress the bounded braille term', () => {
  expect(words('盲文', [{start:0,end:1},{start:1,end:2}])).toEqual(['盲文']);
});

test('an explicit manual split still has priority', () => {
  const source = '盲文';
  const result = analyzeChineseDetailed(source, [
    {start:0,end:1,readings:['mang2']},
    {start:1,end:2,readings:['wen2']},
  ]);
  expect(result.words.map(word => word.raw)).toEqual(['盲', '文']);
  expect(result.words.map(word => word.source)).toEqual(['manual', 'manual']);
});
