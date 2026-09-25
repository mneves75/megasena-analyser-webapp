import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { MAX_CONTEST_NUMBER, parseCanonicalInteger } from '@/lib/api/archive-contract';
import { formatCurrency, formatDate } from '@/lib/utils';
import { loadDrawPage } from '@/app/_lib/archive';
import { countLabel, dezena } from '@/app/_lib/format';

export const alt = 'Dezenas sorteadas no concurso da Mega-Sena';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brand tokens from app/globals.css (dark theme background, --primary / --primary-glow).
const BACKGROUND = '#0d0f12';
const PRIMARY = '#187c95';
const PRIMARY_GLOW = '#2ba6c5';

export default async function Image({
  params,
}: {
  params: Promise<{ numero: string }>;
}): Promise<ImageResponse> {
  const contest = parseCanonicalInteger((await params).numero, 1, MAX_CONTEST_NUMBER);
  const page = contest === null ? null : await loadDrawPage(contest);
  if (!page) {
    notFound();
  }
  const { draw } = page;
  const outcome =
    draw.sena.winners === 0
      ? 'Acumulou'
      : `${countLabel(draw.sena.winners, 'ganhador', 'ganhadores')} · ${formatCurrency(draw.sena.prize)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: BACKGROUND,
          color: '#f4f7f8',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', fontSize: 30, color: PRIMARY_GLOW, fontWeight: 600 }}>
            Resultado da Mega-Sena
          </div>
          <div style={{ display: 'flex', fontSize: 76, fontWeight: 700, letterSpacing: '-1px' }}>
            {`Concurso ${draw.contestNumber}`}
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: '#a9b4ba' }}>
            {formatDate(draw.drawDate)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px' }}>
          {draw.numbers.map((number) => (
            <div
              key={number}
              style={{
                width: 132,
                height: 132,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(180deg, ${PRIMARY_GLOW}, ${PRIMARY})`,
                fontSize: 60,
                fontWeight: 700,
                color: '#ffffff',
              }}
            >
              {dezena(number)}
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: 30,
          }}
        >
          <div style={{ display: 'flex', fontWeight: 600 }}>{outcome}</div>
          <div style={{ display: 'flex', color: '#7c8a91', fontSize: 26 }}>
            megasena-analyzer.com.br
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
