/**
 * Mega da Virada: CAIXA's year-end special contest, "o último concurso da
 * Mega-Sena de final 0 ou 5 de cada ano civil", drawn on 31/12
 * (https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx).
 *
 * Editions already stored, checked against CAIXA's results API. They are listed
 * because the data cannot identify them on its own: CAIXA only flags special
 * contests (`indicadorConcursoEspecial` = 2) from 2017 on, the same flag marks
 * other specials (contest 3010, the Mega 30 Anos, drawn in May 2026), and the
 * archive stored every row with `special_draw` = 0 until v1.16.0. The 2008
 * year-end contest (1035) is not an edition: its prize rolled over to 1036.
 */
export const MEGA_DA_VIRADA_CONTESTS: readonly number[] = [
  1140, 1245, 1350, 1455, 1560, 1665, 1775, 1890, 2000, 2110, 2220, 2330, 2440, 2550, 2670, 2810,
  2955,
];

/**
 * SQL condition on a `draws` row: a listed edition, or a special contest ending
 * in 0 or 5 drawn at the turn of the year (the 2025 edition was postponed to the
 * morning of 01/01/2026). Newly ingested editions are recognised from the flag.
 */
export const MEGA_DA_VIRADA_CONDITION = `(
  contest_number IN (${MEGA_DA_VIRADA_CONTESTS.join(', ')})
  OR (
    special_draw = 1
    AND contest_number % 5 = 0
    AND (substr(draw_date, 6, 5) >= '12-20' OR substr(draw_date, 6, 5) <= '01-10')
  )
)`;

/** The year an edition closes: the draw year, or the previous one for a draw postponed into January. */
export function megaDaViradaEdition(drawDate: string): number {
  const year = Number(drawDate.slice(0, 4));
  return drawDate.slice(5, 7) === '01' ? year - 1 : year;
}

export interface NumberCount {
  number: number;
  count: number;
}

/** How many times each number from 1 to 60 came up in these draws, in number order. */
export function countNumbers(draws: ReadonlyArray<{ numbers: readonly number[] }>): NumberCount[] {
  const counts = Array.from({ length: 60 }, (_, index): NumberCount => ({ number: index + 1, count: 0 }));
  for (const draw of draws) {
    for (const number of draw.numbers) {
      const entry = counts[number - 1];
      if (entry) {
        entry.count += 1;
      }
    }
  }
  return counts;
}

/** Drawn numbers grouped by how often they came up, most frequent first. */
export function groupByCount(counts: readonly NumberCount[]): Array<{ count: number; numbers: number[] }> {
  const groups = new Map<number, number[]>();
  for (const { number, count } of counts) {
    if (count > 0) {
      groups.set(count, [...(groups.get(count) ?? []), number]);
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([count, numbers]) => ({ count, numbers }));
}
