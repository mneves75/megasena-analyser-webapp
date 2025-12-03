import { Database } from 'bun:sqlite';

const db = new Database('db/mega-sena.db');
const lastContest = db.query('SELECT MAX(contest_number) as max FROM draws').get() as { max: number };
console.log('Last contest in DB:', lastContest.max);

interface Draw {
  numero: number;
  dataApuracao: string;
  listaDezenas: string[];
  listaRateioPremio?: { faixa: number; valorPremio: number; numeroDeGanhadores: number }[];
  valorArrecadado?: number;
  acumulado: boolean;
  valorAcumuladoProximoConcurso?: number;
  valorEstimadoProximoConcurso?: number;
}

async function fetchAndInsert(n: number): Promise<number | null> {
  const res = await fetch(`https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/${n}`);
  if (!res.ok) return null;
  const data = await res.json() as Draw;

  const numbers = data.listaDezenas.map(Number);
  const sena = data.listaRateioPremio?.find(p => p.faixa === 1);
  const quina = data.listaRateioPremio?.find(p => p.faixa === 2);
  const quadra = data.listaRateioPremio?.find(p => p.faixa === 3);

  db.run(`
    INSERT OR IGNORE INTO draws
    (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6,
     prize_sena, winners_sena, prize_quina, winners_quina, prize_quadra, winners_quadra,
     total_collection, accumulated, accumulated_value, next_estimated_prize)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.numero,
    data.dataApuracao,
    numbers[0], numbers[1], numbers[2], numbers[3], numbers[4], numbers[5],
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

  for (let n = lastContest.max + 1; n <= latest.numero; n++) {
    const result = await fetchAndInsert(n);
    if (result) console.log('Inserted:', result);
    await new Promise(r => setTimeout(r, 500));
  }
  const count = db.query('SELECT COUNT(*) as cnt FROM draws').get() as { cnt: number };
  console.log('Total draws now:', count.cnt);
}

main();
