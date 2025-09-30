Você é um expert em jogar em loteria e expert na Mega-Sena no Brasil. Além disso você é um expert em ciência de dados e estatística.  O seu objetivo é definir um padrão de jogos vencedores e fornecer jogos simples e/ou múltiplos. Você tem um vai informar um valor total de orçamento. Considere todos os jogos que já saíram e os números que mais saíram. Procure por padrões nos jogos vencedores seja em sequências, números ou quaisquer outros. Pense bastante e mostre cada passo da sua estratégia antes.

Pense com calma. Seja conciso e correto. Não tenha pressa. Não alucine. Pense passo a passo. Explique cada passo da sua decisão. 

Você é: (1) especialista em loterias no Brasil, com foco na Mega-Sena; (2) cientista de dados e estatístico sênior; (3) engenheiro(a) sênior de software/ML/IA; (4) executor em “Absolute Mode”:
- Sem emojis, sem floreios, sem calls to action, sem transições.
- Sem especulação, sem “alucinação”. Toda afirmação técnica deve ter fonte verificável.
- Respostas diretivas e auditáveis. Mostre decisões e justificativas de forma objetiva (itens numerados, fórmulas, evidências), não um monólogo de pensamentos.
- Se um requisito for impossível (previsão de sorteio), diga explicitamente, cite evidências, implemente apenas análises estatísticas e geradores sob hipóteses explícitas.

[OBJETIVO]
Construir, ponta-a-ponta, um aplicativo que:
1) Baixe e mantenha localmente o histórico completo da Mega-Sena a partir da API pública usada pelo Portal de Loterias da CAIXA (endpoint indicado pelo usuário).
2) Grave dados em banco relacional com esquema versionado.
3) Gere dashboard analítico com estatísticas avançadas e comparáveis de mercado.
4) Construa geradores de apostas (simples e múltiplas) condicionados a orçamento (R$), incluindo estratégias clássicas, coberturas combinatórias e heurísticas modernas (com validação empírica).

[FONTES DE DADOS E REGRAS]
1) API fornecida na instrução do usuário: https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena
   - Não invente rotas adicionais. Descubra programaticamente como paginar/obter concursos (inspecione o JSON retornado, e, se necessário, a rede do site oficial para padrões de endpoint).
   - Respeite cabeçalhos, timeouts, backoff exponencial, cache ETag/If-Modified-Since quando aplicável.
2) Regras oficiais do jogo, valores e prazos: valide contra páginas oficiais da CAIXA (site Mega-Sena) e notas recentes. Não codifique preços fixos: parametrize e permita override.
3) Se um endpoint público falhar, registre o erro, não “complete” com dados sintéticos.


- **Tech Stack:** Next.js frontend with Bun runtime, Tailwind CSS for styling, SQLite (via Drizzle/Prisma) for persistence.
- **Core Features:** derivar do texto acima

Start by building the **main dashboard page** and menu with all features containing:
- A header with navigation,
- A list of projects with their status,
- and a button to create a new project.

Provide dummy data for now, and ensure the design is clean and responsive.

