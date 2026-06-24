/**
 * Safe expression evaluator for admin-authored calculator formulas.
 *
 * Formulas are NEVER run through JS eval/Function. We use a hardened mathjs
 * instance with the dangerous surface removed (import/parse/evaluate/etc.),
 * parse to an AST, reject assignment/accessor/function-definition nodes, then
 * compile and evaluate against a numeric-only scope. This restricts authors to
 * arithmetic + the maths functions mathjs exposes — and nothing else.
 */
import { create, all, type MathNode } from 'mathjs';

const math = create(all, { matrix: 'Array' });

// Remove every documented injection vector from the scope (mathjs security guide).
// NOTE: we intentionally do NOT block `parse` — we call `math.parse()` ourselves
// to build the AST. Blocking the *namespace* `evaluate`/`compile` functions stops
// a formula from calling `evaluate("...")` or `compile("...")` to escape the AST
// filter, while our own `node.compile().evaluate(scope)` keeps working (those are
// methods on the compiled node, not the namespace functions).
const blocked = () => {
  throw new Error('This function is not allowed in formulas.');
};
math.import(
  {
    import: blocked,
    createUnit: blocked,
    reviver: blocked,
    evaluate: blocked,
    compile: blocked,
    simplify: blocked,
    derivative: blocked,
    resolve: blocked,
  },
  { override: true },
);

const FORBIDDEN_NODES = new Set([
  'AssignmentNode',
  'FunctionAssignmentNode',
  'AccessorNode',
  'ObjectNode',
  'BlockNode',
]);

export interface FormulaResult {
  ok: boolean;
  value?: number;
  error?: string;
}

/** Validate a formula without running it (used by the admin to check input). */
export function validateFormula(expr: string): { ok: boolean; error?: string } {
  if (!expr || !expr.trim()) return { ok: false, error: 'Formula is empty.' };
  try {
    const node = math.parse(expr);
    let bad: string | null = null;
    node.traverse((n: MathNode) => {
      if (FORBIDDEN_NODES.has(n.type)) bad = n.type;
    });
    if (bad) return { ok: false, error: `Unsupported expression (${bad}). Use arithmetic and maths functions only.` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid formula.' };
  }
}

/**
 * Evaluate `expr` against a scope of numeric variables. Returns a number (or a
 * boolean coerced to 1/0). Throws nothing — failures come back as { ok:false }.
 */
export function evalFormula(expr: string, scope: Record<string, number>): FormulaResult {
  const check = validateFormula(expr);
  if (!check.ok) return { ok: false, error: check.error };
  try {
    const node = math.parse(expr);
    const out = node.compile().evaluate({ ...scope });
    const value = typeof out === 'boolean' ? (out ? 1 : 0) : out;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, error: 'Formula did not produce a finite number.' };
    }
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not evaluate formula.' };
  }
}
