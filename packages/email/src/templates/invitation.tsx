import { Heading, Section, Text } from '@react-email/components'
import { EmailLayout, TransactionalFooter } from './email-layout'
import { BrandButton, BrandLink } from './brand-elements'
import { typography } from './shared-styles'

interface InvitationEmailProps {
  invitedByName: string
  inviteeName?: string
  organizationName: string
  inviteLink: string
  logoUrl?: string
}

export function InvitationEmail({
  invitedByName,
  inviteeName,
  organizationName,
  inviteLink,
  logoUrl,
}: InvitationEmailProps) {
  return (
    <EmailLayout preview={`Join ${organizationName}`} logoUrl={logoUrl} logoAlt={organizationName}>
      {/* Content */}
      <Heading style={typography.h1}>
        {inviteeName ? `Hi ${inviteeName}, you're invited!` : "You're invited!"}
      </Heading>
      <Text style={typography.text}>
        <strong>{invitedByName}</strong> has invited you to join <strong>{organizationName}</strong>
        .
      </Text>

      {/* CTA Button */}
      <Section style={{ textAlign: 'center', marginTop: '32px', marginBottom: '32px' }}>
        <BrandButton href={inviteLink}>Accept Invitation</BrandButton>
      </Section>

      {/* Fallback Link */}
      <Text style={typography.textSmall}>
        Or copy and paste this link into your browser:{' '}
        <BrandLink href={inviteLink}>{inviteLink}</BrandLink>
      </Text>

      {/* Footer */}
      <TransactionalFooter>
        If you weren&apos;t expecting this invitation, you can ignore this email.
      </TransactionalFooter>
    </EmailLayout>
  )
}
