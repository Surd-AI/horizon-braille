import { expect, test } from 'vitest';
import { collectAmbiguities, convertWithResolutions, resolveAmbiguities, type Resolution } from '../packages/core/src/ambiguity';
import { encodeDocument } from '../packages/core/src/convert';
import { EditorSession, executeSemanticJob } from '../apps/playground/src/session';

test.each([
  [0.95, 0.6, true], [0.6, 0.95, true], [0.8, 0.6, true],
  [0.6, 0.6, true], [undefined, 0.8, true], [undefined, 0.6, true],
  [0.49, 0.95, false], [0.5, 0.5, true], [undefined, 0.49, false],
] as const)('confidence %s and probability %s agree across resolution, audit and Worker (adopted %s)', async (confidence, probability, adopted) => {
  const s = new EditorSession(executeSemanticJob, async job => {
    const r = await resolveAmbiguities(job.source, { manual: job.decisions, provider: async qs => ({
      resolutions: qs.filter(q => q.span.start === 0).map(q => ({
        id: q.id, choice: 'chong2', source: 'api', confidence,
        probabilities: { zhong4: 1 - probability, chong2: probability, unknown: 0 },
      })), diagnostics: [],
    }) });
    return { decisions: r, audit: r.audit };
  });
  await s.setSource('重量'); const before = s.result!.unicode;
  await s.resolveOnline();
  expect(s.history[0].audit!.questions.find(q => q.span.start === 0)).toMatchObject({ adopted, outcome: adopted ? 'api' : 'ambiguity-low-confidence' });
  expect(s.result!.metadata.chineseWords[0].syllables[0].reading).toBe(adopted ? 'chong2' : 'zhong4');
  expect(s.result!.unicode === before).toBe(!adopted);
});

test.each(['api', 'manual'] as const)('fresh confident answer replaces prior %s only if not manual', async source => {
  const text = '重量', a = collectAmbiguities(text)[0];
  const r = await resolveAmbiguities(text, { manual: { documentSource: text, resolutions: [{ id: a.id, choice: 'zhong4', source, confidence: 1 }] },
    provider: async qs => ({ resolutions: qs.filter(q => q.id === a.id).map(q => ({ id: q.id, choice: 'chong2', source: 'api', confidence: 0.95 })), diagnostics: [] }) });
  expect(r.resolutions.find(x => x.id === a.id)).toMatchObject({ choice: source === 'manual' ? 'zhong4' : 'chong2', source });
});

test('returned confident semantic decision survives local grammar disagreement', () => {
  const source = '会议$12:30$', a = collectAmbiguities(source).find(q => q.kind === 'colon')!;
  const r: Resolution = { id: a.id, choice: 'ratio', source: 'api', confidence: 0.95 };
  const e = convertWithResolutions(source, { documentSource: source, resolutions: [r] });
  expect(e.diagnostics.some(d => d.code === 'ambiguity-pending' && d.span.start === a.span.start)).toBe(false);
  expect(e.atoms).not.toEqual(encodeDocument(source).atoms);
});

test('adopted invalid clock semantics never fabricate a normalized encoding', async () => {
  const source = '99:99';
  const r = await resolveAmbiguities(source, { provider: async qs => ({ resolutions: qs.map(q => ({ id: q.id, choice: 'time', source: 'api', confidence: 0.95 })), diagnostics: [] }) });
  expect(r.audit!.questions[0]).toMatchObject({ adopted: true, outcome: 'api' });
  const e = convertWithResolutions(source, r, { timePolicy: 'normalize-hours-minutes' });
  expect(e.atoms).toEqual(encodeDocument(source).atoms);
  expect(e.diagnostics.some(d => d.code === 'ambiguity-time-unsupported')).toBe(true);
  expect(e.diagnostics.some(d => d.code === 'ambiguity-time-normalized')).toBe(false);
});


test('adopts screenshot third-row hang2 probability even when aggregate confidence is below threshold', async () => {
  const text = '第三行', a = collectAmbiguities(text).find(q => q.span.start === 2)!;
  const answer: Resolution = { id: a.id, choice: 'hang2', source: 'api', confidence: 0.75869416339559,
    probabilities: { xing2: 0.05093896355905432, hang2: 0.8069553306716473, hang4: 0.13469177498452456, heng2: 0.0010293415018636214, unknown: 0.006384589282910257 } };
  const r = await resolveAmbiguities(text, { provider: async () => ({ resolutions: [answer], diagnostics: [] }) });
  expect(r.audit!.questions.find(q => q.id === a.id)).toMatchObject({ adopted: true, outcome: 'api' });
  const result = convertWithResolutions(text, r);
  expect(result.metadata.chineseWords.flatMap(w => w.syllables).find(s => s.reading === 'hang2')).toBeDefined();
  expect(result.diagnostics.some(d => d.code === 'ambiguity-pending' && d.span.start === a.span.start)).toBe(false);
});

test('high-probability unknown remains unresolved', async () => {
  const text = '重量', a = collectAmbiguities(text)[0];
  const r = await resolveAmbiguities(text, { provider: async () => ({ resolutions: [{ id: a.id, choice: 'unknown', source: 'api', confidence: 1, probabilities: { zhong4: 0, chong2: 0, unknown: 1 } }], diagnostics: [] }) });
  expect(r.audit!.questions.find(q => q.id === a.id)?.adopted).toBe(false);
  expect(convertWithResolutions(text, r).metadata.chineseWords[0].syllables[0].reading).toBe('zhong4');
});
