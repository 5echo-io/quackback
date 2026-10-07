import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import { useEmailBrand } from '../brand'
import { BrandLink, BrandStrip } from './brand-elements'
import { layout, branding, typography } from './shared-styles'

interface EmailLayoutProps {
  preview: string
  /** Overrides the brand's logo — callers that already resolved one pass it. */
  logoUrl?: string
  /** The board's name: the logo's alt text, and the wordmark when there is no logo. */
  logoAlt?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

/**
 * Shared email layout with proper HTML email best practices:
 * - Wrapper Section with background color (fallback for clients that strip <body> styles)
 * - Centered container via React Email's align="center" (no margin:auto)
 * - Consistent header, spacing, and footer placement
 *
 * The header is the board's logo, or its name as a wordmark when it has no
 * logo — never the vendor's logo, which is what an unbranded board used to
 * send. A board with neither shows nothing above the card.
 */
export function EmailLayout({ preview, logoUrl, logoAlt, children, footer }: EmailLayoutProps) {
  const brand = useEmailBrand()
  const logo = logoUrl ?? brand.logoUrl ?? undefined
  const name = logoAlt ?? brand.name

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={layout.main}>
        <Container style={{ maxWidth: layout.container.maxWidth }}>
          {(logo || name) && (
            <Section style={branding.header}>
              {logo ? (
                <Img
                  src={logo}
                  alt={name ?? ''}
                  height={branding.logo.height}
                  style={branding.logo}
                />
              ) : (
                <Row>
                  <Column style={{ ...branding.mark, backgroundColor: brand.primary }}>
                    &nbsp;
                  </Column>
                  <Column>
                    <Text style={branding.name}>{name}</Text>
                  </Column>
                </Row>
              )}
            </Section>
          )}

          <Container style={layout.container}>
            <BrandStrip />
            <Section style={layout.content}>
              {children}

              {footer}
            </Section>
          </Container>
        </Container>
      </Body>
    </Html>
  )
}

/** Standard footer for transactional emails (sign-in, password reset, welcome, invitation) */
export function TransactionalFooter({ children }: { children: React.ReactNode }) {
  return <Text style={typography.footer}>{children}</Text>
}

/** Standard footer for notification emails with unsubscribe link */
export function NotificationFooter({
  reason,
  unsubscribeUrl,
  unsubscribeLabel = 'Unsubscribe from this post',
}: {
  reason: string
  unsubscribeUrl: string
  unsubscribeLabel?: string
}) {
  return (
    <Text style={typography.footer}>
      {reason}
      <br />
      <BrandLink href={unsubscribeUrl} style={{ fontSize: '12.5px' }}>
        {unsubscribeLabel}
      </BrandLink>
    </Text>
  )
}
