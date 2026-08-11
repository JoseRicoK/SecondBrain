import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0f172a, #6d28d9, #0f172a)',
          color: 'white',
          fontSize: 56,
          fontWeight: 800,
        }}
      >
        <div style={{ fontSize: 26, opacity: 0.85, marginBottom: 10 }}>Diario Personal con IA</div>
        <div>SecondBrain</div>
        <div style={{ fontSize: 22, marginTop: 14, opacity: 0.9 }}>Tu Segundo Cerebro Digital</div>
      </div>
    ),
    {
      ...size,
    }
  )
}
