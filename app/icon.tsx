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
          backgroundColor: '#0ea5e9',
          color: '#0b1120',
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: '-0.05em',
        }}
      >
        MS
      </div>
    ),
    {
      ...size,
    }
  );
}


