import type { Payload } from 'payload';

/** Explicit local-development utility. Never writes during production init/build. */
export async function seedDefaultOutreachTemplates(payload: Payload, env: Record<string, string | undefined> = process.env): Promise<void> {
  if (env.NODE_ENV === 'production' || env.ALLOW_DEFAULT_TEMPLATE_SEED !== 'true') return;
  try {
    const { totalDocs } = await payload.count({ collection: 'outreach-templates' as any });
    if (totalDocs > 0) return;
    const templates = [
      {
        name: 'Guest post pitch',
        type: 'guest-post',
        subject: 'Guest post idea for {{siteName}}',
        body:
          'Hi {{contactName}},\n\n' +
          "I'm {{myName}} from HealthyLifeStyles — we build free, evidence-based health calculators.\n\n" +
          'I had an article idea your readers might genuinely use: a practical, non-preachy piece I could write for {{siteName}} (happy to share 2–3 title options). I write from the data our calculators produce, cite primary sources (CDC/WHO/NHS), and keep it educational — no medical claims.\n\n' +
          'If guest contributions are open, could you point me at your guidelines?\n\nThanks either way,\n{{myName}}',
        notes: 'Personalize with a line about a recent post of theirs BEFORE the pitch. Never send as-is.',
      },
      {
        name: '“We made a free calculator”',
        type: 'free-calculator',
        subject: 'A free {{toolName}} your readers can use',
        body:
          'Hi {{contactName}},\n\n' +
          'I noticed {{pageUrl}} covers this topic well. We built a free, no-signup {{toolName}} that might be a useful add-on for your readers: {{toolUrl}}\n\n' +
          "It's evidence-based (sources cited on the page), mobile-friendly, and embeddable — if you'd rather host it inside your article, the embed snippet is one copy-paste.\n\n" +
          'If it fits, a mention or embed would make my day. Happy to return the favor with a look at anything you want feedback on.\n\n{{myName}}',
        notes: 'Best template for a tools site — the tool does the persuading. Only send to genuinely relevant pages.',
      },
      {
        name: 'Broken-link outreach',
        type: 'broken-link',
        subject: 'Broken link on {{pageUrl}}',
        body:
          'Hi {{contactName}},\n\n' +
          'Quick heads-up: {{pageUrl}} links to a resource that now 404s (happy to send the exact anchor if useful).\n\n' +
          'If you want a drop-in replacement, we maintain a free {{toolName}} that covers the same ground: {{toolUrl}} — evidence-based and no signup.\n\n' +
          'Either way, hope the heads-up helps!\n\n{{myName}}',
        notes: 'Verify the broken link yourself first (curl/browser). The value = the heads-up; the link is the ask.',
      },
      {
        name: 'Data-study pitch',
        type: 'data-study',
        subject: 'New data: what {{toolName}} usage reveals',
        body:
          'Hi {{contactName}},\n\n' +
          'We aggregated anonymous usage from our {{toolName}} and found a pattern your audience might care about (happy to share the chart + methodology).\n\n' +
          "If you cover this, you're welcome to the data with attribution — full dataset, methodology, and a quotable summary here: {{toolUrl}}\n\n" +
          'Want the one-page summary?\n\n{{myName}}',
        notes: 'Only use with REAL aggregated data you can defend. Never invent statistics — that torches trust and rankings.',
      },
    ];
    for (const t of templates) {
      await payload.create({ collection: 'outreach-templates' as any, data: t as any });
    }
    payload.logger.info('Seeded 4 default outreach templates.');
  } catch (err) {
    payload.logger.warn('Outreach template seeding skipped: ' + ((err as Error)?.message || 'unknown'));
  }
}
