'use client';
import React from 'react';
import { useAllFormFields } from '@payloadcms/ui';
import { reduceFieldsToValues } from 'payload/shared';
import { evalFormula } from '@/lib/formula';

/* Live formula tester for the Calculator tab. Reads the inputs + outputs arrays
 * from the current form state, renders a sample value for each input, then runs
 * every output expression through the SAME hardened evaluator the public site
 * and the save-time validator use (`evalFormula`) — so an editor can verify a
 * new calculator without leaving the panel. Earlier output keys are available to
 * later outputs, matching runtime behaviour. Coded tools have no formulas, so the
 * tester hides itself for them. */

type AnyRec = Record<string, any>;

function defaultFor(input: AnyRec): number {
  if (input?.type === 'select' || input?.type === 'radio') {
    const first = Array.isArray(input?.options) ? input.options[0] : undefined;
    const n = Number(first?.value);
    return Number.isFinite(n) ? n : 0;
  }
  const dv = Number(input?.defaultValue);
  if (Number.isFinite(dv)) return dv;
  const mn = Number(input?.min);
  return Number.isFinite(mn) ? mn : 0;
}

function findBand(bands: AnyRec[] | undefined, value: number): AnyRec | null {
  if (!Array.isArray(bands) || !bands.length) return null;
  const sorted = [...bands].filter((b) => Number.isFinite(Number(b?.upTo))).sort((a, b) => Number(a.upTo) - Number(b.upTo));
  for (const b of sorted) if (value <= Number(b.upTo)) return b;
  return sorted[sorted.length - 1] || null;
}

export const FormulaTester: React.FC = () => {
  const [fields] = useAllFormFields();
  const data = reduceFieldsToValues(fields, true) as AnyRec;

  const [overrides, setOverrides] = React.useState<Record<string, number>>({});

  if (data?.toolType === 'coded') {
    return (
      <div className="hls-tester hls-tester--muted">
        <p className="hls-tester__note">Coded tools run their own component — there’s no formula to test here.</p>
      </div>
    );
  }

  const inputs: AnyRec[] = Array.isArray(data?.inputs) ? data.inputs : [];
  const outputs: AnyRec[] = Array.isArray(data?.outputs) ? data.outputs : [];
  const usable = inputs.filter((i) => i?.key);

  // Effective sample values: user overrides win, otherwise the field's default.
  const valueFor = (input: AnyRec): number =>
    Object.prototype.hasOwnProperty.call(overrides, input.key) ? overrides[input.key] : defaultFor(input);

  const setVal = (key: string, raw: string) => {
    const n = Number(raw);
    setOverrides((o) => ({ ...o, [key]: Number.isFinite(n) ? n : 0 }));
  };

  // Build scope and evaluate outputs in order (later outputs can use earlier keys).
  const scope: Record<string, number> = {};
  for (const inp of usable) scope[inp.key] = valueFor(inp);
  const results = outputs
    .filter((o) => o?.key && o?.expression)
    .map((o) => {
      const r = evalFormula(String(o.expression), scope);
      if (r.ok && typeof r.value === 'number') {
        scope[o.key] = r.value;
        const decimals = Number.isFinite(Number(o.decimals)) ? Number(o.decimals) : 1;
        return { key: o.key, label: o.label || o.key, ok: true as const, value: r.value, display: r.value.toFixed(decimals), unit: o.unit || '', band: findBand(o.bands, r.value) };
      }
      return { key: o.key, label: o.label || o.key, ok: false as const, error: r.error || 'Could not evaluate.' };
    });

  return (
    <div className="hls-tester">
      <div className="hls-tester__head">
        <span className="hls-tester__title">Formula tester</span>
        <span className="hls-tester__sub">Enter sample values to preview the result. Nothing is saved.</span>
      </div>

      {usable.length === 0 ? (
        <p className="hls-tester__note">Add at least one input (with a variable name) to test the formula.</p>
      ) : (
        <div className="hls-tester__inputs">
          {usable.map((inp) => {
            const v = valueFor(inp);
            const isChoice = inp.type === 'select' || inp.type === 'radio';
            return (
              <label key={inp.key} className="hls-tester__field">
                <span className="hls-tester__label">{inp.label || inp.key} <code>{inp.key}</code></span>
                {isChoice && Array.isArray(inp.options) ? (
                  <select value={String(v)} onChange={(e) => setVal(inp.key, e.target.value)}>
                    {inp.options.map((opt: AnyRec, i: number) => (
                      <option key={i} value={String(opt?.value ?? '')}>{opt?.label || opt?.value}</option>
                    ))}
                  </select>
                ) : inp.type === 'toggle' ? (
                  <input type="checkbox" checked={v === 1} onChange={(e) => setVal(inp.key, e.target.checked ? '1' : '0')} />
                ) : (
                  <input
                    type="number"
                    value={Number.isFinite(v) ? v : 0}
                    min={Number.isFinite(Number(inp.min)) ? Number(inp.min) : undefined}
                    max={Number.isFinite(Number(inp.max)) ? Number(inp.max) : undefined}
                    step={Number.isFinite(Number(inp.step)) ? Number(inp.step) : undefined}
                    onChange={(e) => setVal(inp.key, e.target.value)}
                  />
                )}
              </label>
            );
          })}
        </div>
      )}

      <div className="hls-tester__results">
        {results.length === 0 ? (
          <p className="hls-tester__note">Add an output expression in the Calculator tab to see a result.</p>
        ) : (
          results.map((r) => (
            <div key={r.key} className={`hls-tester__result${r.ok ? '' : ' hls-tester__result--err'}`}>
              <span className="hls-tester__rlabel">{r.label}</span>
              {r.ok ? (
                <span className="hls-tester__rvalue">
                  {r.display}{r.unit ? <span className="hls-tester__runit"> {r.unit}</span> : null}
                  {r.band ? (
                    <span className="hls-tester__band" style={{ background: String(r.band.color || '#64748b') }}>{r.band.label}</span>
                  ) : null}
                </span>
              ) : (
                <span className="hls-tester__rerr">{r.error}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FormulaTester;
