/* ---------------------------------------------------------------------------
 * Persona computation engine.
 *
 * Given a profile's tool usage history and all active persona definitions,
 * determines which personas the profile qualifies for.
 *
 * A persona is assigned when ALL its rules are satisfied:
 *   - "tool"     rule → profile has used that specific tool ≥ minUsage times
 *   - "category" rule → profile has used any tool in that category ≥ minUsage times
 * ------------------------------------------------------------------------- */

export type PersonaRule = {
  matchType: 'tool' | 'category';
  tool?: number | string;
  category?: number | string;
  minUsage: number;
};

export type PersonaDef = {
  id: number | string;
  name: string;
  slug?: string | null;
  rules: PersonaRule[];
};

export type ToolUsageSummary = {
  /** tool ID → count of usages */
  byTool: Record<string, number>;
  /** category ID → count of usages across tools in that category */
  byCategory: Record<string, number>;
};

/** Compute per-tool and per-category usage counts from a list of usage records. */
export function summarizeUsage(
  usages: { tool: { id: number | string; category?: number | string } | number | string }[],
): ToolUsageSummary {
  const byTool: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const u of usages) {
    const toolId = typeof u.tool === 'object' ? String(u.tool?.id ?? u.tool) : String(u.tool);
    byTool[toolId] = (byTool[toolId] || 0) + 1;

    if (typeof u.tool === 'object') {
      const catId = u.tool?.category;
      if (catId != null) {
        const key = String(catId);
        byCategory[key] = (byCategory[key] || 0) + 1;
      }
    }
  }

  return { byTool, byCategory };
}

/** Evaluate all active personas against a profile's usage summary.
 *  Returns the IDs of personas the profile qualifies for. */
export function evaluatePersonas(
  summary: ToolUsageSummary,
  personas: PersonaDef[],
): (number | string)[] {
  const assigned: (number | string)[] = [];

  for (const persona of personas) {
    if (!persona.rules || persona.rules.length === 0) {
      assigned.push(persona.id);
      continue;
    }

    const allMet = persona.rules.every((rule) => {
      if (rule.matchType === 'tool') {
        const toolKey = String(rule.tool ?? '');
        const count = summary.byTool[toolKey] || 0;
        return count >= (rule.minUsage ?? 1);
      }

      if (rule.matchType === 'category') {
        const catKey = String(rule.category ?? '');
        const count = summary.byCategory[catKey] || 0;
        return count >= (rule.minUsage ?? 1);
      }

      return false;
    });

    if (allMet) assigned.push(persona.id);
  }

  return assigned;
}
