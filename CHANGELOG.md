# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Planejado: Fases B–E do redesign de UI (dashboards, formulários, componentes compartilhados).

## [0.2.0] - 2025-09-24

### Added

- Plano de redesign (`docs/UI_REDESIGN_ACTION_PLAN.md`) com diagnóstico e roadmap detalhado.
- Landing page de conversão dedicada em `public/conhecendotudo-landing.html` com copy otimizada.
- Componentes base (dashboard, formulários, UI utility) para suportar futuras fases.

### Changed

- Home e dashboard de estatísticas agora exibem dados dinâmicos provenientes dos serviços de backend.
- Gerador de apostas passou a consumir `generateBetsAction` com fluxo de validação e exportação de payload.
- Histórico `/bets` lista lotes persistidos com orçamento, seed e dezenas formatadas.
- `.gitignore` atualizado para práticas modernas (Node/Next.js) e alinhamento cross-platform.

### Fixed

- Build `next build --turbopack` sem erros de prerender após sanitização de datas nulas.
- Warnings de lint (`no-unused-vars`) em componentes de UI eliminados.

[0.2.0]: https://github.com/mneves75/megasena-analyser-webapp/releases/tag/v0.2.0
