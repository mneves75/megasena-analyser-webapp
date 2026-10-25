import { BASE_URL } from '@/lib/constants';
import { dezena } from '@/app/_lib/format';

// Satori cannot read CSS variables: these are the light-theme tokens of
// app/globals.css (--background, --foreground, --primary, --muted-foreground,
// --border) converted to hex. Change them together with the tokens.
export const BRAND = {
  paper: '#fafbfc',
  ink: '#131e25',
  primary: '#096072',
  muted: '#515e67',
  rule: '#c5ced3',
} as const;

export const SITE_HOST = new URL(BASE_URL).host;

/** The header's six-dot mark (three columns, two rows) at any size. */
export function BrandMark({ dot, gap }: { dot: number; gap: number }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', width: dot * 3 + gap * 2, gap }}>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          style={{ width: dot, height: dot, borderRadius: '50%', background: BRAND.primary }}
        />
      ))}
    </div>
  );
}

/** Square app icon: the mark centred on paper. */
export function IconCard({ dot, gap }: { dot: number; gap: number }): React.JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BRAND.paper,
      }}
    >
      <BrandMark dot={dot} gap={gap} />
    </div>
  );
}

function Wordmark(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <BrandMark dot={12} gap={4} />
      <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: BRAND.ink }}>
        Mega-Sena Analyzer
      </div>
    </div>
  );
}

const FIELD = Array.from({ length: 60 }, (_, index) => index + 1);
const CELL = 50;

/** Site share card: the wordmark and claim beside the empty field of sixty. */
export function SiteCard(): React.JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '64px 72px',
        background: BRAND.paper,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          width: 470,
        }}
      >
        <Wordmark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 58,
              fontWeight: 700,
              lineHeight: 1.05,
              color: BRAND.ink,
            }}
          >
            Todos os concursos desde 1996
          </div>
          <div style={{ display: 'flex', fontSize: 26, lineHeight: 1.35, color: BRAND.muted }}>
            Resultados, frequência das dezenas e gerador de apostas com os dados oficiais da CAIXA.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: BRAND.muted }}>{SITE_HOST}</div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          width: CELL * 10 + 1,
          borderTop: `3px solid ${BRAND.primary}`,
          borderLeft: `1px solid ${BRAND.rule}`,
        }}
      >
        {FIELD.map((number) => (
          <div
            key={number}
            style={{
              width: CELL,
              height: CELL,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: `1px solid ${BRAND.rule}`,
              borderBottom: `1px solid ${BRAND.rule}`,
              fontSize: 20,
              color: BRAND.muted,
            }}
          >
            {dezena(number)}
          </div>
        ))}
      </div>
    </div>
  );
}
