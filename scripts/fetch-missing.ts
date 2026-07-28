import { normalizePrizeDescription } from '@/lib/api/caixa-client';
import { Database } from 'bun:sqlite';
import { PairAnalysisEngine } from '@/lib/analytics/pair-analysis';
import { StatisticsEngine } from '@/lib/analytics/statistics';
import { toIsoDate } from '@/lib/utils';

const db = new Database('db/mega-sena.db');
const lastContest = db.query('SELECT MAX(contest_number) as max FROM draws').get() as { max: number };
console.log('Last contest in DB:', lastContest.max);

interface PrizeTier {
  faixa?: number;
  descricaoFaixa?: string;
  valorPremio: number;
  numeroDeGanhadores: number;
}

interface Draw {
  numero: number;
  dataApuracao: string;
  listaDezenas: string[];
  listaRateioPremio?: PrizeTier[];
  rateioProcessamento?: PrizeTier[];
  valorArrecadado?: number;
  acumulado: boolean;
  valorAcumuladoProximoConcurso?: number;
  valorEstimadoProximoConcurso?: number;
}

// A CAIXA alterna entre rateioProcessamento e listaRateioPremio conforme a
// época/endpoint; espelha o fallback duplo de lib/api/caixa-client.ts para os
// dois campos e para faixa numérica vs descricaoFaixa.
function findPrizeTier(data: Draw, faixa: number, descricao: string): PrizeTier | undefined {
  const tiers =
    Array.isArray(data.rateioProcessamento) && data.rateioProcessamento.length > 0
      ? data.rateioProcessamento
      : Array.isArray(data.listaRateioPremio)
        ? data.listaRateioPremio
        : [];
  return tiers.find((tier) => {
    if (tier.faixa === faixa) return true;
    const normalized = normalizePrizeDescription(tier.descricaoFaixa, tier.faixa);
    return normalized === descricao;
  });
}

async function fetchAndInsert(n: number): Promise<number | null> {
  const res = await fetch(`https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/${n}`);
  if (!res.ok) return null;
  const data = await res.json() as Draw;

  const numbers = data.listaDezenas.map(Number);
  const hasInvalidNumbers = numbers.some(
    (value) => typeof value !== 'number' || Number.isNaN(value)
  );
  if (numbers.length !== 6 || hasInvalidNumbers) {
    return null;
  }
  const [n1, n2, n3, n4, n5, n6] = numbers as [
    number,
    number,
    number,
    number,
    number,
    number
  ];
  const sena = findPrizeTier(data, 1, 'Sena');
  const quina = findPrizeTier(data, 2, 'Quina');
  const quadra = findPrizeTier(data, 3, 'Quadra');

  db.run(`
    INSERT OR IGNORE INTO draws
    (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6,
     prize_sena, winners_sena, prize_quina, winners_quina, prize_quadra, winners_quadra,
     total_collection, accumulated, accumulated_value, next_estimated_prize)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.numero,
    toIsoDate(data.dataApuracao),
    n1, n2, n3, n4, n5, n6,
    sena?.valorPremio || 0,
    sena?.numeroDeGanhadores || 0,
    quina?.valorPremio || 0,
    quina?.numeroDeGanhadores || 0,
    quadra?.valorPremio || 0,
    quadra?.numeroDeGanhadores || 0,
    data.valorArrecadado || 0,
    data.acumulado ? 1 : 0,
    data.valorAcumuladoProximoConcurso || 0,
    data.valorEstimadoProximoConcurso || 0
  ]);
  return data.numero;
}

async function main() {
  const latestRes = await fetch('https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena');
  const latest = await latestRes.json() as Draw;
  console.log('Latest draw from CAIXA:', latest.numero);

  let insertedCount = 0;
  for (let n = lastContest.max + 1; n <= latest.numero; n++) {
    const result = await fetchAndInsert(n);
    if (result) {
      insertedCount++;
      console.log('Inserted:', result);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  const count = db.query('SELECT COUNT(*) as cnt FROM draws').get() as { cnt: number };
  console.log('Total draws now:', count.cnt);

  if (insertedCount > 0) {
    console.log('Inserted draws this run:', insertedCount);
  }

  // Rebuild unconditionally: draws commit before this point, so gating on
  // insertedCount would let a crash between insert and rebuild leave the
  // derived caches stale forever (the read path no longer repairs them).
  new StatisticsEngine().updateNumberFrequencies();
  new PairAnalysisEngine().updatePairFrequencies();
  console.log('[OK] Frequency and pair caches updated');
}

main();
