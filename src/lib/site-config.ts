/**
 * Single source of truth for the site domain and GSC property.
 * The ONLY place the domain is resolved — never hardcode it elsewhere.
 */

export const SITE_BASE_URL = process.env.SITE_BASE_URL || 'https://www.healthylifesstyles.com'
export const GSC_SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:healthylifesstyles.com'

// Validation
if (SITE_BASE_URL.endsWith('/')) {
  throw new Error('SITE_BASE_URL must not end with "/"')
}

// Property-format guard
if (GSC_SITE_URL.startsWith('sc-domain:')) {
  // Must contain NO protocol/slash
  const domain = GSC_SITE_URL.slice('sc-domain:'.length)
  if (domain.includes('://') || domain.includes('/')) {
    throw new Error(`GSC_SITE_URL with sc-domain: must not contain protocol or slash. Got: ${GSC_SITE_URL}`)
  }
} else if (GSC_SITE_URL.startsWith('https://') || GSC_SITE_URL.startsWith('http://')) {
  // URL-prefix property MUST end with /
  if (!GSC_SITE_URL.endsWith('/')) {
    throw new Error(`GSC_SITE_URL as URL-prefix must end with "/". Got: ${GSC_SITE_URL}`)
  }
}

/** Build an absolute URL from a path. The path must start with "/". */
export const absoluteUrl = (path: string): string => {
  if (!path.startsWith('/')) path = `/${path}`
  return `${SITE_BASE_URL}${path}`
}
