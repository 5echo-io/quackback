/**
 * The pieces of an email that wear the board's brand.
 *
 * Templates are plain functions — tests and `send*Email` both call them
 * directly — so they cannot read context themselves. These are components
 * rendered inside them, which can: each takes the brand `sendEmail` resolved
 * (see ../brand.tsx), or the neutral default when there is none.
 */
import { Button, Column, Link, Row, Section } from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'
import { linkColor, useEmailBrand } from '../brand'
import { button, utils } from './shared-styles'

/** The call to action, filled with the brand colour. */
export function BrandButton({ href, children }: { href: string; children: ReactNode }) {
  const brand = useEmailBrand()
  return (
    <Button
      href={href}
      style={{
        ...button.base,
        backgroundColor: brand.primary,
        color: brand.primaryForeground,
      }}
    >
      {children}
    </Button>
  )
}

/** A text link, in the brand colour when that reads on white. */
export function BrandLink({
  href,
  style,
  children,
}: {
  href: string
  style?: CSSProperties
  children: ReactNode
}) {
  const brand = useEmailBrand()
  return (
    <Link href={href} style={{ ...utils.link, color: linkColor(brand), ...style }}>
      {children}
    </Link>
  )
}

/** The bar beside a quoted comment or message. */
export function AccentBar() {
  const brand = useEmailBrand()
  return <Column style={{ width: '3px', backgroundColor: brand.primary, borderRadius: '2px' }} />
}

/** The board's name, or `fallback` when the instance has none configured. */
export function BrandName({ fallback }: { fallback: string }) {
  return <>{useEmailBrand().name ?? fallback}</>
}

/** A small mark in the brand colour, for lists that used a coloured glyph. */
export function BrandCheck() {
  const brand = useEmailBrand()
  return <span style={{ color: brand.primary, fontWeight: 700 }}>✓</span>
}

/** The strip of brand colour across the top of the card. */
export function BrandStrip() {
  const brand = useEmailBrand()
  return (
    <Section>
      <Row>
        <Column
          style={{
            height: '3px',
            lineHeight: '3px',
            fontSize: '0',
            backgroundColor: brand.primary,
          }}
        >
          &nbsp;
        </Column>
      </Row>
    </Section>
  )
}
