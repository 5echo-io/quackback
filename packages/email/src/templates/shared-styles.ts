/**
 * Shared email styles.
 *
 * Neutral on purpose: the one colour an email carries is the board's own
 * brand, applied by the components in brand-elements.tsx from the brand
 * `sendEmail` resolves. Nothing here may name a colour that belongs to a
 * product — a board run by somebody else should not arrive in our yellow.
 *
 * The shape is a grey page, a white card with a hairline border and a strip
 * of brand colour across its top, and a quiet footer under a rule.
 */

export const colors = {
  // Text
  heading: '#16181d',
  text: '#525a68',
  textMuted: '#8b92a1',

  // Surfaces
  background: '#f5f6f9',
  surface: '#ffffff',
  surfaceMuted: '#f5f6f9',

  // Lines
  border: '#e7e8ee',
  rule: '#eeeff3',
}

const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'

// Common layout styles
export const layout = {
  main: {
    backgroundColor: colors.background,
    fontFamily,
    margin: '0',
    padding: '32px 12px 44px',
  },
  container: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: '16px',
    borderCollapse: 'separate' as const,
    overflow: 'hidden' as const,
    maxWidth: '600px',
  },
  content: {
    padding: '34px 40px 30px',
  },
}

// Typography styles
export const typography = {
  h1: {
    color: colors.heading,
    fontSize: '26px',
    fontWeight: '700' as const,
    letterSpacing: '-0.6px',
    lineHeight: '1.2',
    marginTop: '0',
    marginBottom: '12px',
  },
  h2: {
    color: colors.heading,
    fontSize: '20px',
    fontWeight: '600' as const,
    lineHeight: '28px',
    marginTop: '0',
    marginBottom: '8px',
  },
  text: {
    color: colors.text,
    fontSize: '15.5px',
    lineHeight: '1.6',
    marginTop: '0',
    marginBottom: '24px',
  },
  textSmall: {
    color: colors.textMuted,
    fontSize: '14px',
    lineHeight: '22px',
    marginTop: '0',
    marginBottom: '16px',
  },
  footer: {
    color: colors.textMuted,
    fontSize: '12.5px',
    lineHeight: '1.6',
    borderTop: `1px solid ${colors.rule}`,
    paddingTop: '18px',
    marginTop: '32px',
    marginBottom: '0',
  },
}

// Button shape. The fill and text colour come from the brand (BrandButton).
export const button = {
  base: {
    borderRadius: '6px',
    fontSize: '15px',
    fontWeight: '600',
    padding: '12px 28px',
    textDecoration: 'none',
    display: 'inline-block',
  },
}

// Utility styles
export const utils = {
  divider: {
    borderTop: `1px solid ${colors.rule}`,
    marginTop: '32px',
    marginBottom: '32px',
  },
  // Link shape. The colour comes from the brand (BrandLink).
  link: {
    textDecoration: 'underline',
  },
  codeBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    padding: '24px',
    textAlign: 'center' as const,
  },
  code: {
    color: colors.heading,
    fontSize: '32px',
    fontWeight: '700' as const,
    letterSpacing: '0.2em',
    fontFamily: 'monospace',
    marginTop: '0',
    marginBottom: '0',
  },
  quote: {
    backgroundColor: colors.surfaceMuted,
    borderLeft: `3px solid ${colors.border}`,
  },
}

// Logo / wordmark above the card
export const branding = {
  header: {
    padding: '0 8px 14px',
  },
  logo: {
    height: 40,
    maxWidth: 200,
    display: 'block' as const,
  },
  mark: {
    width: '26px',
    height: '26px',
    borderRadius: '7px',
    fontSize: '0',
    lineHeight: '0',
  },
  name: {
    color: colors.heading,
    fontFamily,
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '-0.2px',
    paddingLeft: '11px',
    margin: '0',
  },
  strip: {
    height: '3px',
    lineHeight: '3px',
    fontSize: '0',
  },
}
