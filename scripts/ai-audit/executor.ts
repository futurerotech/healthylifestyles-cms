/**
 * AI SEO Autopilot — Executor (§5 Phase 2, DRY-RUN MODE).
 *
 * Takes findings from the audit crawler/detectors and generates proposed
 * fixes using the provider-agnostic AI gateway. In DRY-RUN mode, proposed
 * fixes are written to the audit-log collection but NEVER applied to the
 * live content.
 */

import { z } from 'zod'
import { chat } from '../../src/services/ai'
import type { Finding } from './detectors'

export interface ProposedFix {
  pageId: number
  collection: string
  slug: string
  title: string
  url: string
  field: string
  issue: string
  currentValue: string
  proposedValue: string
  aiModel: string
  confidence: 'high' | 'medium' | 'low'
  status: 'proposed'
}

// Zod schema for the meta-description fix response
const metaDescSchema = z.object({
  metaDescription: z.string().min(100).max(160),
})

/**
 * Generate a proposed meta description fix using the AI gateway.
 * The AI is instructed to write a 150-155 char description with the
 * primary keyword in the first 120 chars. It NEVER writes the fix to
 * the database — it only proposes text for human review.
 */
export async function proposeMetaDescriptionFix(
  finding: Finding,
): Promise<ProposedFix> {
  const prompt = `You are an SEO meta description writer for a YMYL health website.

Write a meta description for this article:
Title: "${finding.title}"
URL: ${finding.url}
Current issue: ${finding.issue}

Rules:
- Exactly 150-155 characters (count carefully)
- Include the primary keyword from the title within the first 120 characters
- Benefit-driven, plain language, no clickbait
- Educational tone — no medical claims, no diagnosis, no treatment advice
- End with a soft CTA ("Free calculator included", "Learn how", etc.)
- No quotes, no ALL CAPS, no em dashes

Respond as JSON: {"metaDescription": "your description here"}`

  let proposedValue = ''
  let confidence: 'high' | 'medium' | 'low' = 'medium'
  let model = 'unknown'

  try {
    const result = await chat({
      taskType: 'meta_trim',
      messages: [
        { role: 'system', content: 'You are an SEO meta description writer. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      schema: metaDescSchema,
    })

    if (result.ok) {
      proposedValue = result.data.metaDescription
      model = result.model

      // Validate length
      if (proposedValue.length >= 150 && proposedValue.length <= 155) {
        confidence = 'high'
      } else if (proposedValue.length >= 140 && proposedValue.length <= 160) {
        confidence = 'medium'
      } else {
        confidence = 'low'
      }
    } else {
      proposedValue = `[AI unavailable: ${result.error}]`
      confidence = 'low'
    }
  } catch (err) {
    proposedValue = `[AI error: ${(err as Error).message}]`
    confidence = 'low'
  }

  return {
    pageId: finding.pageId,
    collection: finding.collection,
    slug: finding.slug,
    title: finding.title,
    url: finding.url,
    field: 'seo.metaDescription',
    issue: finding.issue,
    currentValue: finding.currentValue,
    proposedValue,
    aiModel: model,
    confidence,
    status: 'proposed',
  }
}

/**
 * Process all findings and generate proposed fixes.
 * In DRY-RUN mode, fixes are returned as an array — the caller
 * writes them to audit-log. No content is modified.
 */
export async function executeDryRun(
  findings: Finding[],
): Promise<ProposedFix[]> {
  const fixes: ProposedFix[] = []

  for (const finding of findings) {
    if (finding.issue.startsWith('Missing meta description') || finding.issue.includes('too long') || finding.issue.includes('too short')) {
      const fix = await proposeMetaDescriptionFix(finding)
      fixes.push(fix)
    }
  }

  return fixes
}
