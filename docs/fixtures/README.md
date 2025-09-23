# Fixtures

Fixtures sintetizam concursos e estratégias para testes offline.

## Como usar

- `sample-draw.json`: usado em testes de ingestão/parsing.
- `sample-bets.json`: conjunto pequeno para validar cálculos de cobertura.

Durante testes automatizados, carregue os arquivos com `fs.readFileSync` e popule o banco SQLite em memória.
