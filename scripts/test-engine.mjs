/**
 * Verifies the safe formula engine against the installed mathjs: correct maths,
 * multiple/derived outputs, bands, conditionals (ternary), and that injection
 * attempts are blocked (no code execution). Run: npm run test:engine
 */
import { create, all } from 'mathjs';

const math = create(all, { matrix: 'Array' });
const blocked = () => { throw new Error('not allowed'); };
// Mirror src/lib/formula.ts: keep `parse` (we call math.parse), block the rest
// incl. namespace evaluate/compile (node methods are unaffected).
math.import(
  { import: blocked, createUnit: blocked, reviver: blocked, evaluate: blocked, compile: blocked, simplify: blocked, derivative: blocked, resolve: blocked },
  { override: true },
);
const FORBIDDEN = new Set(['AssignmentNode', 'FunctionAssignmentNode', 'AccessorNode', 'ObjectNode', 'BlockNode']);

function evalFormula(expr, scope) {
  try {
    const node = math.parse(expr);
    let bad = null;
    node.traverse((n) => { if (FORBIDDEN.has(n.type)) bad = n.type; });
    if (bad) return { ok: false, error: 'forbidden ' + bad };
    const out = node.compile().evaluate({ ...scope });
    const v = typeof out === 'boolean' ? (out ? 1 : 0) : out;
    if (typeof v !== 'number' || !Number.isFinite(v)) return { ok: false, error: 'not finite' };
    return { ok: true, value: v };
  } catch (e) { return { ok: false, error: e.message }; }
}

function runCalculator(outputs, inputs) {
  const scope = { ...inputs };
  const computed = [];
  for (const o of outputs) {
    const r = evalFormula(o.expression, scope);
    if (!r.ok) { computed.push({ key: o.key, error: r.error }); continue; }
    scope[o.key] = r.value;
    let band;
    if (o.bands) { const m = [...o.bands].sort((a, b) => a.upTo - b.upTo).find((b) => r.value <= b.upTo); band = m && m.label; }
    computed.push({ key: o.key, value: Number(r.value.toFixed(o.decimals ?? 1)), band });
  }
  return computed;
}

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

console.log('Maths & outputs:');
const bmi = runCalculator(
  [{ key: 'bmi', expression: 'weight / (height/100)^2', decimals: 1, bands: [
    { upTo: 18.5, label: 'Underweight' }, { upTo: 25, label: 'Normal' }, { upTo: 30, label: 'Overweight' }, { upTo: 99, label: 'Obese' },
  ] }],
  { weight: 72, height: 175 },
);
ok('BMI 72kg/175cm = 23.5', bmi[0].value === 23.5);
ok('BMI band = Normal', bmi[0].band === 'Normal');

const derived = runCalculator(
  [
    { key: 'bmr', expression: '10*weight + 6.25*height - 5*age + 5', decimals: 0 },
    { key: 'tdee', expression: 'bmr * activity', decimals: 0 }, // references earlier output
  ],
  { weight: 80, height: 180, age: 30, activity: 1.55 },
);
ok('derived output tdee uses bmr', derived[1].value === Math.round((10 * 80 + 6.25 * 180 - 5 * 30 + 5) * 1.55));

console.log('Conditionals (ternary):');
const cond = runCalculator(
  [{ key: 'flag', expression: 'waist / height < 0.5 ? 0 : 1', decimals: 0 }],
  { waist: 80, height: 180 },
);
ok('ternary returns 0 when healthy', cond[0].value === 0);

console.log('Security — injection blocked, no execution:');
globalThis.__pwned = false;
ok('blocks evaluate()', !evalFormula('evaluate("1+1")', {}).ok);
ok('blocks import()', !evalFormula('import({})', {}).ok);
ok('blocks accessor (constructor)', !evalFormula('cos.constructor', {}).ok);
ok('blocks assignment', !evalFormula('x = 5', {}).ok);
ok('blocks function definition', !evalFormula('f(x) = x^2', {}).ok);
ok('unknown symbol fails safely', !evalFormula('definitelyNotDefined + 1', {}).ok);
ok('no global side effects', globalThis.__pwned === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
