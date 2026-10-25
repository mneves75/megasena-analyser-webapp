import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { MAX_CONTEST_NUMBER, parseCanonicalInteger } from '@/lib/api/archive-contract';
import { formatCurrency, formatDate } from '@/lib/utils';
import { loadDrawPage } from '@/app/_lib/archive';
import { BRAND, BrandMark, SITE_HOST } from '@/app/_lib/brand-image';
import { countLabel, dezena } from '@/app/_lib/format';

export const alt = 'Dezenas sorteadas no concurso da Mega-Sena';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        background: BRAND.paper,
        color: BRAND.ink,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <BrandMark dot={11} gap={4} />
          <div style={{ display: 'flex', fontSize: 28, color: BRAND.muted }}>
            Resultado da Mega-Sena
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, letterSpacing: '-1px' }}>
          {`Concurso ${draw.contestNumber}`}
        </div>
        <div style={{ display: 'flex', fontSize: 32, color: BRAND.muted }}>
          {formatDate(draw.drawDate)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        {draw.numbers.map((number) => (
          <div
            key={number}
            style={{
              width: 128,
              height: 128,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: BRAND.primary,
              fontSize: 58,
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
          borderTop: `3px solid ${BRAND.primary}`,
          paddingTop: 20,
          fontSize: 30,
        }}
      >
        <div style={{ display: 'flex', fontWeight: 600 }}>{outcome}</div>
        <div style={{ display: 'flex', color: BRAND.muted, fontSize: 24 }}>{SITE_HOST}</div>
      </div>
    </div>,
    { ...size }
  );
}
