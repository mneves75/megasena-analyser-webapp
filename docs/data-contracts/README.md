# Data Contracts

Este diretório armazena contratos e observações sobre APIs, payloads e fontes externas. Cada arquivo documenta:

- Campos consumidos e conversões aplicadas.
- Campos ignorados com justificativa.
- Links para fonte oficial e data da coleta.

- `strategy_payload.schema.json`: contrato JSON para registros do motor de apostas (Stage 3). A implementação de runtime utiliza `src/data-contracts/strategy-payload-schema.ts` e valida o payload via AJV.

Antes de alterar sincronização ou schema, atualize o contrato correspondente e referencie a data da consulta.
