/**
 * Devflow Renderers -- Badge Generators
 *
 * Produces Devflow Governed badges in three formats:
 *   - Markdown (inline image + link)
 *   - HTML (inline <span> with styling)
 *   - SVG (standalone vector graphic)
 */

const BADGE_LABEL = "Devflow"
const BADGE_MESSAGE = "Governed"
const BADGE_COLOR = "#6e3af2"
const BADGE_LINK = "https://github.com/tjsasakifln/devflow"

/**
 * Returns a markdown badge linking to the Devflow repository.
 * Renders as: [![Devflow Governed](https://img.shields.io/badge/...)](https://...)
 */
export function devflowGovernedMarkdownBadge(): string {
  const encodedLabel = encodeURIComponent(BADGE_LABEL)
  const encodedMessage = encodeURIComponent(BADGE_MESSAGE)
  const encodedColor = encodeURIComponent(BADGE_COLOR)
  const imageUrl = `https://img.shields.io/badge/${encodedLabel}-${encodedMessage}-${encodedColor}`
  const escapedImage = imageUrl.replace(/\)/g, "%29")
  return `[![Devflow Governed](${escapedImage})](${BADGE_LINK})`
}

/**
 * Returns an inline HTML element for the Devflow Governed badge.
 * Uses inline styles so it works inside any HTML context.
 */
export function devflowGovernedHtmlBadge(): string {
  return [
    `<span style="display:inline-flex;align-items:center;gap:4px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1;white-space:nowrap;">`,
    `<span style="padding:3px 6px;border-radius:3px 0 0 3px;background:#555;color:#fff;font-weight:600;">Devflow</span>`,
    `<span style="padding:3px 6px;border-radius:0 3px 3px 0;background:${BADGE_COLOR};color:#fff;font-weight:600;">Governed</span>`,
    `</span>`,
  ].join("")
}

/**
 * Returns a standalone SVG badge (purple shield shape with Devflow Governed text).
 * Dimensions: 200 x 40. Designed to be embedded directly or saved as .svg.
 */
export function devflowGovernedSvgBadge(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40" viewBox="0 0 200 40" role="img" aria-label="Devflow Governed">`,
    `  <defs>`,
    `    <linearGradient id="d-bg" x1="0%" y1="0%" x2="100%" y2="0%">`,
    `      <stop offset="0%" stop-color="#555"/>`,
    `      <stop offset="42%" stop-color="#555"/>`,
    `      <stop offset="42%" stop-color="${BADGE_COLOR}"/>`,
    `      <stop offset="100%" stop-color="${BADGE_COLOR}"/>`,
    `    </linearGradient>`,
    `  </defs>`,
    `  <rect width="200" height="40" rx="6" fill="url(#d-bg)"/>`,
    `  <rect x="0" y="0" width="84" height="40" fill="#555" rx="6"/>`,
    `  <rect x="0" y="0" width="6" height="40" fill="#555"/>`,
    `  <rect x="78" y="0" width="6" height="40" fill="${BADGE_COLOR}"/>`,
    `  <text x="42" y="26" font-family="system-ui,-apple-system,sans-serif" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">Devflow</text>`,
    `  <text x="142" y="26" font-family="system-ui,-apple-system,sans-serif" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">Governed</text>`,
    `</svg>`,
  ].join("\n")
}
