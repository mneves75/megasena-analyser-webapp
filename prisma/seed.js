// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function combination(n, k) {
  if (k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - (k - i))) / i;
  }
  return Math.round(result);
}

async function main() {
  const fonte =
    "https://caixanoticias.caixa.gov.br/Paginas/Noticias/2025/07-JULHO/Apostas-das-Loterias-CAIXA-terao-novos-valores.aspx";
  const dataAtualizacao = new Date("2025-07-12T00:00:00Z");
  const dataConsulta = new Date("2025-09-23T00:00:00Z");
  const precoBaseCents = 600;

  await prisma.meta.upsert({
    where: { key: "schema_version" },
    update: { value: "1" },
    create: { key: "schema_version", value: "1" },
  });

  await prisma.meta.upsert({
    where: { key: "last_sync" },
    update: { value: "never" },
    create: { key: "last_sync", value: "never" },
  });

  await prisma.meta.upsert({
    where: { key: "price_last_checked" },
    update: { value: dataConsulta.toISOString() },
    create: { key: "price_last_checked", value: dataConsulta.toISOString() },
  });

  const priceEntries = Array.from({ length: 10 }, (_, idx) => idx + 6).map(
    (k) => ({
      k,
      valor_cents: combination(k, 6) * precoBaseCents,
      fonte,
      atualizado_em: dataAtualizacao,
    }),
  );

  for (const entry of priceEntries) {
    await prisma.price.upsert({
      where: { k: entry.k },
      update: {
        valor_cents: entry.valor_cents,
        fonte: entry.fonte,
        atualizado_em: entry.atualizado_em,
      },
      create: entry,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Erro ao executar seed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
