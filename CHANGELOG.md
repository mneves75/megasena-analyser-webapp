# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CHANGELOG.md to track project changes

## [1.0.0] - 2025-09-30

### Added
- CLI smoke coverage and extended documentation
- Betting limit audit tooling for compliance verification
- Stage 6 roadmap and finalized betting documentation
- Betting API endpoints with persistence and server actions (`/api/generate-bets`)
- Logging and schema validation to betting workflow
- Stage 3 betting workflow with comprehensive documentation
- Phase 5 execution plans and review documentation
- Data grid integration for generated bets history
- SQLite database with complete draw history storage
- Statistical analysis engine (hot/cold numbers, frequency analysis)
- Multiple bet generation strategies:
  - Random (Aleatório)
  - Hot Numbers (Números Quentes)
  - Cold Numbers (Números Frios)
  - Balanced (Balanceado)
  - Fibonacci sequence-based
- Interactive dashboard with data visualizations
- CAIXA API integration with exponential backoff
- Database migration system (`bun run db:migrate`)
- Data ingestion script (`bun run db:pull`)
- Responsive UI with TailwindCSS v4 and shadcn/ui components
- Framer Motion micro-interactions and animations
- TypeScript strict mode with complete type safety
- Vitest unit testing framework
- ESLint configuration with zero-warnings policy
- Prettier code formatting

### Changed
- Aligned strategy metadata with React Server Components guidelines
- Unified bets history grid layout
- Broadened hero and main container spacing
- Widened main container layout for better content visibility
- Refined stats dashboard and generator layout
- Applied Fase A layout refresh for improved UX
- Organized Phase 5 execution plans for better structure
- Refreshed Phase 5 review plan after strategy audit

### Fixed
- Multiple lint issues resolved for clean codebase
- Betting workflow validation edge cases

### Removed
- Outdated planning documentation for clarity

## [0.1.0] - Initial Development

### Added
- Initial Next.js 15 project setup with App Router
- Bun runtime configuration (≥1.1.0)
- Project structure and core architecture
- Development and build tooling
- Design system foundations

---

## How to Update This Changelog

After each commit or before each release, update this file following these guidelines:

### Categories
- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security vulnerability fixes

### Format
```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New feature description

### Changed
- Modification description

### Fixed
- Bug fix description
```

### Versioning Rules
- **MAJOR** (X.0.0) - Incompatible API changes
- **MINOR** (0.X.0) - Backwards-compatible functionality additions
- **PATCH** (0.0.X) - Backwards-compatible bug fixes

### Unreleased Section
Keep an `[Unreleased]` section at the top for changes not yet released:
```markdown
## [Unreleased]

### Added
- Feature in development
```

When releasing, move items from `[Unreleased]` to a new version section.

### References
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
