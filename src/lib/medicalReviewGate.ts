/**
 * Effective-state medical review gate for Tools saves.
 * The existing checkbox and reviewer are editorial attestations, not proof
 * of clinical qualification. Never create or infer an approval here.
 */
type SaveData = Record<string, unknown>;

export function enforceMedicalReview({ data, originalDoc, operation }: {
  data?: SaveData | null;
  originalDoc?: SaveData | null;
  operation: string;
}): SaveData | undefined {
  if (operation !== 'create' && operation !== 'update') return data ?? undefined;
  if (operation === 'update' && !originalDoc) {
    throw new Error('Cannot verify the medical review status without the original tool record.');
  }

  // Payload collection hooks can receive a delta. Undefined is not an
  // explicit change; null and false must not fall back to an old attestation.
  const next = Object.fromEntries(Object.entries(data ?? {}).filter(([, value]) => value !== undefined));
  const effective: SaveData = {
    enabled: true,
    riskLevel: 'low',
    medicalReviewRequired: false,
    medicallyReviewed: false,
    ...(originalDoc ?? {}),
    ...next,
  };

  if (effective.riskLevel === 'high') {
    next.medicalReviewRequired = true;
    effective.medicalReviewRequired = true;
  }

  // Only an explicit draft or disabled state is safe to save unreviewed.
  // Do not infer a draft from a query parameter or absent status alone.
  const goingLive = effective.enabled !== false && effective._status !== 'draft';
  if (goingLive && effective.riskLevel !== 'low' && effective.riskLevel !== 'medium' && effective.riskLevel !== 'high') {
    throw new Error('A valid medical risk level is required before enabling and publishing this tool.');
  }
  if (goingLive && effective.medicalReviewRequired !== true &&
      effective.medicalReviewRequired !== false && effective.medicalReviewRequired != null) {
    throw new Error('Invalid medical review requirement.');
  }
  if (goingLive && effective.medicalReviewRequired === true &&
      (effective.medicallyReviewed !== true || typeof effective.reviewedBy !== 'string' || !effective.reviewedBy.trim())) {
    throw new Error(
      'This tool requires medical review before it can be enabled and published. ' +
      'Save it as a draft (or untick "Enabled") until a qualified reviewer has checked it, ' +
      'then record the reviewer name/credential and tick "Medically reviewed".',
    );
  }
  return next;
}
