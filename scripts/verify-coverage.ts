import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export type RuleStatus = 'verified' | 'implemented-unverified' | 'uncovered' | 'not-applicable';
export interface ApplicabilityExclusion {
  reason: string; profile: string; reviewedBy: string; reviewedAt: string;
  evidence: { url: string; locator: string; sourceSha256: string };
}
interface InventoryManifest {
  complete: boolean; review: { reviewedBy: string; reviewedAt: string } | null;
  entries: { id: string; standard: string; clause: string; granularity: 'chapter' | 'clause';
    applicability: 'applicable' | 'excluded'; exclusion?: ApplicabilityExclusion }[];
}
// This separately maintained minimum must not be regenerated from a reduced registry.
const manifest: InventoryManifest = JSON.parse(readFileSync(new URL('../standards/inventory-manifest.json', import.meta.url), 'utf8'));
export interface StandardRule {
  id: string; standard: string; clause: string; scope: string; status: RuleStatus;
  evidence: { url: string; locator: string; sourceSha256: string; note?: string };
  fixtureIds: string[]; exclusion?: ApplicabilityExclusion;
}
export interface Coverage { fullStandardSupport: boolean; inventoryComplete: boolean; advertisedRuleIds: string[] }
export interface StandardFixture {
  id: string; ruleId: string; provenance: string; reviewed: boolean; kind: string;
  input: unknown; expectedDots: string[];
  review?: {method: string; locator: string; sourceSha256: string};
}
const statuses = ['verified','implemented-unverified','uncovered','not-applicable'];
const sha = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function verifyCoverage(rules: StandardRule[], coverage: Coverage, fixtures: StandardFixture[]): string[] {
  const errors: string[]=[];
  const seen = new Set<string>();
  const fixtureIds = new Set<string>();
  for (const f of fixtures) {
    if (fixtureIds.has(f.id)) errors.push(`duplicate fixture ${f.id}`);
    fixtureIds.add(f.id);
  }
  for (const r of rules) {
    if(seen.has(r.id))errors.push(`duplicate rule ${r.id}`);
    seen.add(r.id);
    if(!r.id || !r.standard || !r.clause || !r.scope || !statuses.includes(r.status) || !Array.isArray(r.fixtureIds))errors.push(`invalid rule ${r.id}`);
    if(r.status==='not-applicable') {
      const entry=manifest.entries.find(e=>e.id===r.id && e.standard===r.standard && e.clause===r.clause);
      const x=r.exclusion;
      const approved=entry?.exclusion;
      if(entry?.granularity!=='clause' || entry.applicability!=='excluded' || !x || !approved ||
        !x.reason?.trim() || !x.profile?.trim() || !x.reviewedBy?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(x.reviewedAt ?? '') ||
        !/^https:\/\//.test(x.evidence?.url ?? '') || !x.evidence?.locator?.trim() || !sha(x.evidence?.sourceSha256) ||
        ['reason','profile','reviewedBy','reviewedAt'].some(key=>x[key as keyof ApplicabilityExclusion]!==approved[key as keyof ApplicabilityExclusion]) ||
        ['url','locator','sourceSha256'].some(key=>x.evidence[key as keyof typeof x.evidence]!==approved.evidence?.[key as keyof typeof x.evidence])) {
        errors.push(`reviewed clause-specific exclusion required in manifest ${r.id}`);
      }
    }
    if(r.status==='verified') {
      if(!/^https:\/\//.test(r.evidence?.url ?? '') || !r.evidence?.locator || !sha(r.evidence?.sourceSha256))errors.push(`missing official evidence ${r.id}`);
      const linked = (r.fixtureIds ?? []).map(id=>fixtures.find(f=>f.id===id));
      if(!linked.length || linked.some(f=>!f || !f.reviewed || f.provenance!=='official' || f.ruleId!==r.id || f.review?.method!=='visual' || !f.review.locator || !sha(f.review.sourceSha256) || f.review.sourceSha256!==r.evidence.sourceSha256 || f.input===undefined || !Array.isArray(f.expectedDots)))errors.push(`missing reviewed fixture evidence ${r.id}`);
      if(!linked.some(f=>f?.kind==='positive') || !linked.some(f=>f?.kind==='negative'))errors.push(`positive and negative fixtures required ${r.id}`);
    }
  }
  for(const id of coverage.advertisedRuleIds) {
    const r=rules.find(r=>r.id===id);
    if(!r)errors.push(`unknown advertised rule ${id}`);
    else if(r.status!=='verified')errors.push(`advertised rule must be verified ${id}`);
  }
  if(coverage.fullStandardSupport) {
    if(!coverage.inventoryComplete)errors.push('full support requires complete inventory');
    if(!manifest.complete || !manifest.review?.reviewedBy?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.review?.reviewedAt ?? ''))errors.push('full support requires human-reviewed complete inventory manifest');
    for(const entry of manifest.entries) {
      const r=rules.find(r=>r.id===entry.id && r.standard===entry.standard && r.clause===entry.clause);
      if(!r)errors.push(`inventory manifest rule missing ${entry.id}`);
      else if(entry.applicability==='applicable' && r.status!=='verified')errors.push(`manifest applicable rule must be verified ${entry.id}`);
    }
    for(const id of ['GF0019-2018','GB/T18028-2010','GB/T44725-2024'])if(!rules.some(r=>r.standard===id))errors.push(`missing standard ${id}`);
    if(!rules.length || rules.some(r=>!['verified','not-applicable'].includes(r.status)))errors.push('full support requires all applicable rules verified');
  }
  return errors;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
  const rules:StandardRule[]=read('standards/registry.json');
  const coverage:Coverage=read('standards/coverage.json');
  const errors=verifyCoverage(rules,coverage,[...read('tests/standards/official.json'),...read('tests/standards/gf0019.json'),...read('tests/standards/gb18028-math.json'),...read('tests/standards/gb18028-physics.json'),...read('tests/standards/gb18028-chemistry.json'),...read('tests/standards/layout.json')]);
  console.log(JSON.stringify({valid:!errors.length,fullStandardSupport:coverage.fullStandardSupport,inventoryComplete:coverage.inventoryComplete,counts:Object.fromEntries(statuses.map(status=>[status,rules.filter(r=>r.status===status).length])),errors},null,2));
  if(errors.length)process.exitCode=1;
}
