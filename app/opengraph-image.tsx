import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Mega-Sena Analyzer - Analise Estatistica';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Lottery balls decoration */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '40px',
          }}
        >
          {[4, 15, 23, 38, 51, 60].map((num) => (
            <div
              key={num}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #22c55e, #16a34a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 'bold',
                color: 'white',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
              }}
            >
              {num.toString().padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Main title */}
        <h1
          style={{
            fontSize: '72px',
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #22c55e, #4ade80)',
            backgroundClip: 'text',
            color: 'transparent',
            margin: '0 0 16px 0',
            lineHeight: 1.1,
          }}
        >
          Mega-Sena Analyzer
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '32px',
            color: '#a1a1aa',
            margin: '0',
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          Analise Estatistica e Gerador de Apostas
        </p>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: '32px',
            marginTop: '48px',
          }}
        >
          {['Estatisticas', 'Padroes', 'Gerador'].map((feature) => (
            <div
              key={feature}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#4ade80',
                fontSize: '20px',
                fontWeight: '500',
              }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* URL */}
        <p
          style={{
            position: 'absolute',
            bottom: '32px',
            fontSize: '18px',
            color: '#71717a',
          }}
        >
          megasena-analyzer.com.br
        </p>
      </div>
    ),
    {
      ...size,
    }
  );
}
