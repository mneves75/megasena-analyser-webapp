/**
 * Sequence guard for a partially ingested archive.
 *
 * Real CAIXA contests form a gap-free run starting at 1. Two cases are safe:
 * a missing tail (the newest contests are not published yet) and a range that
 * continues the stored archive. Everything else leaves a hole that 404s a real
 * draw, makes the previous/next pager skip a contest, and makes every later
 * import abort on its own sequence check.
 */
export function assertContiguousArchive(
  fetchedContests: readonly number[],
  storedLastContest: number
): void {
  const contests = [...fetchedContests].sort((left, right) => left - right);

  for (let index = 1; index < contests.length; index += 1) {
    const previous = contests[index - 1];
    const current = contests[index];
    if (previous === undefined || current === undefined) {
      continue;
    }
    if (current !== previous + 1) {
      throw new Error(
        `A ingestão parcial deixaria um buraco entre os concursos ${previous} e ` +
          `${current}. Recolha os concursos ausentes antes de gravar.`
      );
    }
  }

  const lowest = contests[0];
  if (lowest === undefined) {
    return;
  }

  if (lowest > storedLastContest + 1) {
    throw new Error(
      `A ingestão parcial começaria no concurso ${lowest}, deixando de fora ` +
        `${storedLastContest + 1} até ${lowest - 1}. Recolha o intervalo ausente antes de gravar.`
    );
  }
}
