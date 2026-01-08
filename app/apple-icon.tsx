import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)',
          borderRadius: '40px',
          position: 'relative',
        }}
      >
        {/* Main lottery ball */}
        <div
          style={{
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #ffffff 0%, #e8e8e8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(0,0,0,0.3), inset 0 4px 8px rgba(255,255,255,0.9)',
          }}
        >
          {/* Number 6 */}
          <span
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#0369a1',
              fontFamily: 'system-ui, sans-serif',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            6
          </span>
        </div>

        {/* Decorative ball - top right */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #fbbf24 0%, #f59e0b 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />

        {/* Decorative ball - bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #34d399 0%, #10b981 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />

        {/* Decorative ball - top left */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #f472b6 0%, #ec4899 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
