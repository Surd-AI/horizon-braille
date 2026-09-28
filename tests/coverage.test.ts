import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
describe('standards publication gate', () => {
  test('baseline includes each required standard even when not covered', () => {
    const registry = read('standards/registry.json');
    for (const id of ['GF0019-2018','GB/T18028-2010','GB/T44725-2024']) {
      expect(registry.some((r: any) => r.standard === id), id).toBe(true);
    }
  });
  test('advertised rules have independently reviewed official fixtures', () => {
    const registry = read('standards/registry.json');
    const coverage = read('standards/coverage.json');
    const fixtures = [...read('tests/standards/official.json'),...read('tests/standards/gf0019.json'),...read('tests/standards/gb18028-math.json'),...read('tests/standards/gb18028-physics.json'),...read('tests/standards/gb18028-chemistry.json'),...read('tests/standards/layout.json')];
    for (const id of coverage.advertisedRuleIds) {
      const rule = registry.find((r: any) => r.id === id);
      expect(rule?.status).toBe('verified');
      expect(rule.evidence.url).toMatch(/^https:\/\//);
      expect(rule.fixtureIds.length).toBeGreaterThan(0);
      expect(rule.fixtureIds.every((fid: string) => fixtures.some((f: any) => f.id === fid && f.reviewed && f.provenance === 'official'))).toBe(true);
    }
    if (coverage.fullStandardSupport) {
      expect(coverage.inventoryComplete).toBe(true);
      expect(registry.length).toBeGreaterThan(0);
      expect(registry.every((r: any) => ['verified','not-applicable'].includes(r.status))).toBe(true);
    }
  });
});

import { verifyCoverage } from '../scripts/verify-coverage';
const sample = (): {rules: any[]; coverage: any; fixtures: any[]} => ({
  rules: [{id:'r',standard:'GF0019-2018',clause:'7',scope:'tone',status:'verified',evidence:{url:'https://www.moe.gov.cn/example',locator:'printed 4',sourceSha256:'a'.repeat(64)},fixtureIds:['positive','negative']}],
  coverage: {fullStandardSupport:false,inventoryComplete:false,advertisedRuleIds:['r']},
  fixtures: [
    {id:'positive',ruleId:'r',reviewed:true,provenance:'official',kind:'positive',input:'tone1',expectedDots:['1'],review:{method:'visual',locator:'printed 4',sourceSha256:'a'.repeat(64)}},
    {id:'negative',ruleId:'r',reviewed:true,provenance:'official',kind:'negative',input:'neutral',expectedDots:[],review:{method:'visual',locator:'printed 4',sourceSha256:'a'.repeat(64)}}
  ]
});
test('rejects promotion of incomplete coverage to full support', () => {
  const s=sample(); s.coverage.fullStandardSupport=true;
  expect(verifyCoverage(s.rules,s.coverage,s.fixtures).join(' ')).toMatch(/inventory/i);
});
test.each(['uncovered','implemented-unverified'])('rejects advertising %s rules', status => {
  const s=sample(); s.rules[0].status=status;
  expect(verifyCoverage(s.rules,s.coverage,s.fixtures).join(' ')).toMatch(/verified/);
});
test.each(['missing','unreviewed','legacy','wrong-rule','no-negative','no-review'])('rejects %s fixture evidence', mode => {
  const s=sample();
  if(mode==='missing')s.fixtures=[];
  if(mode==='unreviewed')s.fixtures[0].reviewed=false;
  if(mode==='legacy')s.fixtures[0].provenance='legacy';
  if(mode==='wrong-rule')s.fixtures[0].ruleId='other';
  if(mode==='no-negative')s.fixtures[1].kind='positive';
  if(mode==='no-review')delete (s.fixtures[0] as any).review;
  expect(verifyCoverage(s.rules,s.coverage,s.fixtures).length).toBeGreaterThan(0);
});
test('rejects unknown advertised ids and duplicate rule ids', () => {
  const s=sample(); s.coverage.advertisedRuleIds.push('unknown');s.rules.push(s.rules[0]);
  expect(verifyCoverage(s.rules,s.coverage,s.fixtures).join(' ')).toMatch(/unknown/);
  expect(verifyCoverage(s.rules,s.coverage,s.fixtures).join(' ')).toMatch(/duplicate/);
});
test('rejects missing official evidence and unjustified non-applicability', () => {
  const s=sample();s.rules[0].evidence.url='';s.rules[0].status='not-applicable';
  expect(verifyCoverage(s.rules,s.coverage,s.fixtures).length).toBeGreaterThan(0);
});
test('accepts independent positive/negative evidence and honest incomplete baseline', () => {
  const s=sample(); expect(verifyCoverage(s.rules,s.coverage,s.fixtures)).toEqual([]);
  expect(verifyCoverage(read('standards/registry.json'),read('standards/coverage.json'),[...read('tests/standards/official.json'),...read('tests/standards/gf0019.json')])).toEqual([]);
});

test('rejects a reduced three-standard all-excluded registry despite complete flag', () => {
  const registry=read('standards/registry.json');
  const reduced=['GF0019-2018','GB/T18028-2010','GB/T44725-2024'].map(standard=>({
    ...registry.find((r:any)=>r.standard===standard),status:'not-applicable',exclusionReason:'software only'
  }));
  const errors=verifyCoverage(reduced,{fullStandardSupport:true,inventoryComplete:true,advertisedRuleIds:[]},[]);
  expect(errors.join(' ')).toMatch(/manifest.*missing/i);
  expect(errors.join(' ')).toMatch(/exclusion/i);
});
test('rejects blanket exclusions of the full inventory without clause review', () => {
  const rules=read('standards/registry.json').map((r:any)=>({...r,status:'not-applicable',exclusionReason:'not in scope'}));
  expect(verifyCoverage(rules,{fullStandardSupport:true,inventoryComplete:true,advertisedRuleIds:[]},[]).join(' ')).toMatch(/reviewed.*exclusion/i);
});
test('complete registry and reviewed fixtures still require human-reviewed inventory manifest', () => {
  const s=sample();
  const rules=read('standards/registry.json').map((r:any)=>({...r,status:'verified',evidence:s.rules[0].evidence,fixtureIds:[r.id+'-positive',r.id+'-negative']}));
  const fixtures=rules.flatMap((r:any)=>s.fixtures.map(f=>({...f,id:r.id+'-'+f.kind,ruleId:r.id})));
  expect(verifyCoverage(rules,{fullStandardSupport:true,inventoryComplete:true,advertisedRuleIds:[]},fixtures).join(' ')).toMatch(/human-reviewed.*manifest/i);
});
