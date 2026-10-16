/** Startup defaults require an explicit development opt-in, never production. */
export function canSeedDevelopmentDefaults(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.ALLOW_DEFAULT_TEMPLATE_SEED === 'true';
}
