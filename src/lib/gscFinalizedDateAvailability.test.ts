import { describe, expect, it } from 'vitest';
import { requireFinalizedDateAvailability } from './gscFinalizedDateAvailability';
const period={startDate:'2026-08-01',endDate:'2026-08-28'};
describe('GSC finalized-date preflight',()=>{
 it('accepts only distinct PT calendar dates in the requested period',()=>{
   expect(requireFinalizedDateAvailability({rows:[{keys:['2026-08-01']},{keys:['2026-08-28']}]},period)).toBe(2);
 });
 it('rejects impossible calendar dates, unsorted results and hidden provider errors',()=>{
   for(const rows of [
     [{keys:['2026-08-32']}],
     [{keys:['2026-08-02']},{keys:['2026-08-01']}],
     [{keys:['2026-08-01']},{keys:['2026-08-01']}],
   ]) expect(()=>requireFinalizedDateAvailability({rows},period)).toThrow();
   expect(()=>requireFinalizedDateAvailability({rows:[{keys:['2026-08-01']}],error:{code:403}},period)).toThrow(/envelope/);
   expect(()=>requireFinalizedDateAvailability({rows:[{keys:['2026-08-01']}],responseAggregationType:'unrecognized'},period)).toThrow(/envelope/);
   expect(()=>requireFinalizedDateAvailability({rows:[{keys:['2026-08-01']}],responseAggregationType:'auto'},period)).toBe(1);
   expect(()=>requireFinalizedDateAvailability({rows:[{keys:['2026-02-29']}]},{startDate:'2026-02-01',endDate:'2026-02-28'})).toThrow();
 });
 it('fails closed on empty and malformed reports',()=>{
   for(const response of [{}, {rows:[]}, {rows:null}, {error:'private'},
     {rows:[{keys:['2026-09-01']}]}, {rows:[{keys:['2026-08-01']},{keys:['2026-08-01']}]},
     {rows:[{keys:['not-a-date']}]}, {rows: Array.from({length:29},()=>({keys:['2026-08-01']}))}]) {
     expect(()=>requireFinalizedDateAvailability(response,period)).toThrow();
   }
 });
});