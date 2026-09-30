# Migração e aceite

Este arquivo registra somente requisitos públicos. Contas, endereços operacionais,
inventários, backups, logs e resultados privados ficam fora do Git.

- [x] Implementar frontend Worker, API compartilhada e SQLite Durable Object.
- [x] Implementar ingestão diária persistente, idempotência e recuperação de falhas.
- [x] Atualizar o seed público da CAIXA e preservar os dados existentes.
- [x] Executar gates documentados e verificação independente do candidato.
- [x] Preparar e verificar cópias recuperáveis antes da migração.
- [x] Conferir a transferência inicial de registros por comparação integral.
- [x] Ativar os domínios no destino e verificar o site público com Argent.
- [x] Suspender o escritor anterior e reconciliar o delta final com snapshot consistente.
- [x] Arquivar e retirar somente os recursos deste aplicativo após aceite público.
- [x] Publicar a versão final e verificar identidade, CI e disponibilidade pública.

## Privacidade do repositório

- [x] Remover detalhes operacionais e notas pessoais da árvore pública atual.
- [x] Verificar o histórico separadamente; alterações novas não apagam commits anteriores.
- [x] Preparar backup e limpar branches e tags com autorização explícita.
- [x] Verificar publicação do histórico limpo, preservação do código e CI.

A limpeza das referências publicadas não elimina cópias em clones, forks ou
caches externos. Novos trabalhos devem partir do histórico atualizado.
Documentos históricos de operação foram normalizados para versões públicas
atuais; os arquivos da aplicação de cada versão foram preservados.

Procedimentos e gates: [AGENTS.md](../AGENTS.md), [DEPLOY.md](../docs/DEPLOY.md).
