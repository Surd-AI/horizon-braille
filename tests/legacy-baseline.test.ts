import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import legacy from './standards/legacy-math.json';

test('retains frozen historical fixture identity without claiming to rerun absent legacy sources', () => {
  // Git checkout newline conventions do not alter the frozen JSON content.
  const bytes = readFileSync(new URL('./standards/legacy-math.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('c5da9d4f8ae1be29187c12bfb876f3d65dca2ab178eab663355f2156c22c2990');
  expect(legacy.provenance).toBe('legacy');
  expect(legacy.reviewed).toBe(false);
  expect(legacy.source.sha256).toBe('195295d255c7d2d9e1709adf8b6fdb6b6854659cb364bfda41e3a259fbc72944');
  expect(legacy.cases).toHaveLength(27);
  expect(new Set(legacy.cases.map(c => c.id)).size).toBe(27);
  for (const entry of legacy.cases) {
    expect(entry.input.length).toBeGreaterThan(0);
    expect(entry.expected.length).toBeGreaterThan(0);
    expect(entry.width).toBe(30);
  }
});
