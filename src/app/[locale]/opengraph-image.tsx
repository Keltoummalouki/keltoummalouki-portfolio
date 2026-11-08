import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { PERSON } from '@/features/seo/site'

// Social share card for every locale (/fr/opengraph-image, /en/…, /ar/…).
// Satori rules: flex layouts only, and every element with more than one child
// sets `display: flex`. The bundled default font only covers Latin, so the
// Arabic card uses the English role/location (Arabic glyphs would not render).

export const alt = `${PERSON.name} — ${PERSON.jobTitle} based in Casablanca, Morocco`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ROLE: Record<string, string> = {
  fr: 'Développeuse Web Full Stack',
  en: PERSON.jobTitle,
}

const LOCATION: Record<string, string> = {
  fr: 'Casablanca, Maroc',
  en: 'Casablanca, Morocco',
}

// Site palette (dark theme): background, foreground, muted, primary, accent.
const COLORS = {
  background: '#000000',
  foreground: '#FAFAFA',
  muted: '#A3A3A3',
  primary: '#2A6AFF',
}

async function photoDataUri(): Promise<string | null> {
  try {
    // Literal segments so output file tracing bundles the photo with the function.
    const file = await readFile(path.join(process.cwd(), 'public', 'images', 'keltoum.png'))
    return `data:image/png;base64,${file.toString('base64')}`
  } catch (err) {
    console.error('opengraph-image: profile photo unavailable:', err)
    return null
  }
}

export default async function OpenGraphImage({
  params,
}: {
  // Next 15 passes a plain object; accept a promise too (forward compatible).
  params: Promise<{ locale: string }> | { locale: string }
}) {
  const { locale } = await params
  const role = ROLE[locale] ?? ROLE.en
  const location = LOCATION[locale] ?? LOCATION.en
  const photo = await photoDataUri()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 88px',
          backgroundColor: COLORS.background,
          color: COLORS.foreground,
        }}
      >
        {photo && (
          <div
            style={{
              display: 'flex',
              padding: 8,
              borderRadius: 9999,
              backgroundColor: COLORS.primary,
              flexShrink: 0,
            }}
          >
            <img
              src={photo}
              alt=""
              width={320}
              height={320}
              style={{ borderRadius: 9999, objectFit: 'cover', border: `6px solid ${COLORS.background}` }}
            />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: photo ? 72 : 0,
            flexGrow: 1,
          }}
        >
          <div style={{ display: 'flex', fontSize: 80, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            {PERSON.name}
          </div>
          <div style={{ display: 'flex', marginTop: 20, fontSize: 42, color: COLORS.primary }}>{role}</div>
          <div style={{ display: 'flex', marginTop: 16, fontSize: 32, color: COLORS.muted }}>{location}</div>
          <div
            style={{
              display: 'flex',
              marginTop: 44,
              width: 120,
              height: 6,
              borderRadius: 6,
              backgroundColor: COLORS.primary,
            }}
          />
          <div style={{ display: 'flex', marginTop: 24, fontSize: 30, color: COLORS.foreground }}>
            keltoummalouki.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
