import { ImageResponse } from 'next/og';

export const size = {
  width: 64,
  height: 64,
};

export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: '16px',
          position: 'relative',
        }}
      >
        {/* Main lottery ball */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #ffffff 0%, #e0e0e0 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.8)',
          }}
        >
          {/* Number 6 - represents Mega-Sena's 6 numbers */}
          <span
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#0369a1',
              fontFamily: 'system-ui, sans-serif',
              textShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
          >
            6
          </span>
        </div>

        {/* Small decorative ball - top right */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #fbbf24 0%, #f59e0b 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />

        {/* Small decorative ball - bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            left: '4px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #34d399 0%, #10b981 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
