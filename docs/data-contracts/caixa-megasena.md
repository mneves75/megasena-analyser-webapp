# Contrato de Dados — API Mega-Sena (CAIXA)

Fonte oficial: `https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena`.

## Campos relevantes

| Campo                            | Tipo     | Descrição                                                 |
| -------------------------------- | -------- | --------------------------------------------------------- |
| `numero`                         | número   | Identificador do concurso (inteiro).                      |
| `dataApuracao`                   | string   | Data do sorteio no formato `dd/MM/yyyy`.                  |
| `listaDezenas`                   | string[] | Dezenas sorteadas em ordem crescente (strings numéricas). |
| `listaRateioPremio`              | objeto[] | Informações por faixa de premiação (ver abaixo).          |
| `localSorteio`                   | string   | Local oficial do sorteio.                                 |
| `nomeMunicipioUFSorteio`         | string   | Cidade/UF concatenados.                                   |
| `valorArrecadado`                | número   | Arrecadação total em reais.                               |
| `valorAcumuladoProximoConcurso`  | número   | Valor acumulado para o próximo concurso em reais.         |
| `valorAcumuladoConcursoEspecial` | número   | Valor acumulado para Mega da Virada (quando aplicável).   |
| `valorEstimadoProximoConcurso`   | número   | Estimativa em reais.                                      |
| `numeroConcursoAnterior`         | número   | Concurso anterior disponível.                             |
| `numeroConcursoProximo`          | número   | Próximo concurso divulgado.                               |
| `dataProximoConcurso`            | string   | Data prevista do próximo concurso (`dd/MM/yyyy`).         |

### Estrutura de `listaRateioPremio`

| Campo                | Tipo   | Descrição                                      |
| -------------------- | ------ | ---------------------------------------------- |
| `descricaoFaixa`     | string | Identificador da faixa (ex.: "Sena", "Quina"). |
| `numeroDeGanhadores` | número | Quantidade de vencedores na faixa.             |
| `valorPremio`        | número | Valor do prêmio por ganhador (reais).          |

### Campos auxiliares observados

- `acumulado` (boolean) – indica se houve acúmulo.
- `observacao` (string) – comentários da CAIXA.
- `tipoJogo` (string) – sempre `MEGA_SENA` para esse endpoint.

## Conversões aplicadas no projeto

- Datas (`dataApuracao`, `dataProximoConcurso`) convertidas para `Date` via `toISOString()`.
- Valores monetários convertidos de reais (`number`) para centavos (`Int`) multiplicando por 100 e arredondando.
- `listaDezenas` serializada como inteiros via `parseInt` e normalizada em `DrawDezena` conforme ordem original.
- `listaRateioPremio` mapeada para `PrizeFaixa` (`faixa`, `ganhadores`, `premio`).
- Flag `acumulado` armazenada em `Draw.acumulou`.
- Valores acumulados/estimados armazenados em centavos (`Int`).

## Campos ignorados inicialmente

- `valorTotalPremioFaixaUm` (pode ser derivado).
- `valorAcumuladoFaixaAcumulada` (usar somente se necessário para métricas futuras).
- `observacao` (avaliar se deve ser exibido em futura UI).

Atualize este contrato sempre que a CAIXA alterar o schema ou quando novos campos forem consumidos.
