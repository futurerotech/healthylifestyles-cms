/**
 * The config-driven calculator engine. Given a tool's `outputs` config (each an
 * admin-authored formula + display settings) and the user's input values, it
 * produces formatted results, category bands, and gauge data — no per-tool code.
 * Shared shape between the Payload admin (formula validation/preview) and the
 * public <CalculatorEngine> renderer.
 */
import { evalFormula } from './formula';

export interface BandConfig {
  /** Inclusive upper bound for this band. */
  upTo: number;
  label: string;
  color: string;
}

export interface OutputConfig {
  key: string;
  label: string;
  /** Safe mathjs expression over the input variables (and earlier outputs). */
  expression: string;
  unit?: string;
  decimals?: number;
  bands?: BandConfig[];
}

export interface ComputedOutput {
  key: string;
  label: string;
  value: number;
  formatted: string;
  unit?: string;
  band?: { label: string; color: string };
  /** Gauge data when bands are configured. */
  gauge?: { min: number; max: number; value: number; segments: BandConfig[] };
  error?: string;
}

export interface CalcResult {
  ok: boolean;
  outputs: ComputedOutput[];
}

/** Run every output formula in order; later outputs may reference earlier ones. */
export function runCalculator(outputs: OutputConfig[], inputs: Record<string, number>): CalcResult {
  const scope: Record<string, number> = { ...inputs };
  const computed: ComputedOutput[] = [];

  for (const o of outputs) {
    const r = evalFormula(o.expression, scope);
    if (!r.ok || r.value === undefined) {
      computed.push({ key: o.key, label: o.label, value: NaN, formatted: '—', unit: o.unit, error: r.error });
      continue;
    }
    const value = r.value;
    scope[o.key] = value;

    const decimals = o.decimals ?? 1;
    const num = Number(value.toFixed(decimals));
    const formatted = `${num.toLocaleString('en-US', { maximumFractionDigits: decimals })}${o.unit ? ` ${o.unit}` : ''}`;

    let band: ComputedOutput['band'];
    let gauge: ComputedOutput['gauge'];
    if (o.bands && o.bands.length) {
      const sorted = [...o.bands].sort((a, b) => a.upTo - b.upTo);
      const matched = sorted.find((b) => value <= b.upTo) ?? sorted[sorted.length - 1];
      band = { label: matched.label, color: matched.color };
      const min = 0;
      const max = sorted[sorted.length - 1].upTo;
      gauge = { min, max, value: Math.max(min, Math.min(max, value)), segments: sorted };
    }

    computed.push({ key: o.key, label: o.label, value, formatted, unit: o.unit, band, gauge });
  }

  return { ok: computed.every((c) => !c.error), outputs: computed };
}
