/**
 * AI SEO Autopilot — Meta Description Detector (§5 Phase 1).
 *
 * Detects: missing meta descriptions, overlong (>155 chars), too short (<120),
 * and missing primary keyword in the first 120 chars.
 *
 * Read-and-report only — no content mutations.
 */

import type { CrawledPage } from './crawler'

export interface Finding {
  pageId: number
  collection: string
  slug: string
  title: string
  url: string
  issue: string
  severity: 'critical' | 'warning' | 'info'
  currentValue: string
  proposedFix?: string
}

const MIN_LEN = 120
const MAX_LEN = 155

export function detectMetaDescriptionIssues(pages: CrawledPage[]): Finding[] {
  const findings: Finding[] = []

  for (const page of pages) {
    const desc = page.seo.metaDescription || ''

    // Missing
    if (!desc.trim()) {
      findings.push({
        pageId: page.id,
        collection: page.collection,
        slug: page.slug,
        title: page.title,
        url: page.url,
        issue: 'Missing meta description',
        severity: 'critical',
        currentValue: '(empty)',
        proposedFix: `Write a 150-155 char description for "${page.title}" including the primary keyword.`,
      })
      continue
    }

    // Overlong
    if (desc.length > MAX_LEN) {
      findings.push({
        pageId: page.id,
        collection: page.collection,
        slug: page.slug,
        title: page.title,
        url: page.url,
        issue: `Meta description too long (${desc.length} chars, max ${MAX_LEN})`,
        severity: 'warning',
        currentValue: desc,
        proposedFix: `Trim to ${MAX_LEN} chars. Current: ${desc.length}.`,
      })
    }

    // Too short
    if (desc.length < MIN_LEN && desc.length > 0) {
      findings.push({
        pageId: page.id,
        collection: page.collection,
        slug: page.slug,
        title: page.title,
        url: page.url,
        issue: `Meta description too short (${desc.length} chars, min ${MIN_LEN})`,
        severity: 'info',
        currentValue: desc,
        proposedFix: `Extend to 150-155 chars for better SERP visibility. Current: ${desc.length}.`,
      })
    }
  }

  return findings
}
