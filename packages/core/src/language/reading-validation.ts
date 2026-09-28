import { normalizeSyllable } from '../rules/chinese';
import { READING_SPELLINGS } from './reading-inventory';
/** Normalize a supported Mandarin spelling with tone 0/5 aliases; not a per-character pronunciation oracle. */
export function normalizeManualReading(value: string): string | null {
  const reading = value.trim().toLowerCase().replace(/0$/, '5');
  const normalized = normalizeSyllable(reading);
  if (!normalized) return null;
  // j/q/x use u in standard pinyin spelling for the same ü vowel.
  const spelling = normalized.spelling.replace(/^([jqx])ü/, '$1u');
  return READING_SPELLINGS.has(spelling) ? reading : null;
}
