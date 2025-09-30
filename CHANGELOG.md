# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Robust error handling for API responses in bet generation
- Response validation for Content-Type and empty response bodies
- Detailed error messages for JSON parsing failures

### Fixed
- **CRITICAL:** "Unexpected end of JSON input" error when generating bets
- JSON parsing errors now caught with descriptive user-facing messages
- Empty response detection before attempting JSON parsing
- Content-Type validation to ensure valid JSON responses

## [1.0.2] - 2025-09-30

### Added
- **Path-based routing support** - Application now accessible via `/megasena-analyzer` path
- `basePath` and `assetPrefix` configuration in Next.js for subpath deployment
- Path access setup script (`scripts/setup-path-access.sh`)
- Manual setup guide (`MANUAL_PATH_SETUP.md`)
- Public access configuration guide (`ACCESS_GUIDE.md`)
- Comprehensive production deployment documentation (`docs/DEPLOYMENT.md`)
- Updated remote update script with sshpass support

### Changed
- Application URL structure changed to support path-based routing
- All routes now prefixed with `/megasena-analyzer`
- Homepage: `/megasena-analyzer`
- Dashboard: `/megasena-analyzer/dashboard`
- Statistics: `/megasena-analyzer/dashboard/statistics`
- Generator: `/megasena-analyzer/dashboard/generator`

### Fixed
- **CRITICAL:** Port conflict - changed from 3001 to 3002 (free port)
- **CRITICAL:** NVM sourcing in all SSH sessions for Node.js/npm availability
- **CRITICAL:** Heredoc variable substitution in .env.production and ecosystem.config.js
- **CRITICAL:** TypeScript build errors - excluded test and old directories from compilation
- npm install strategy - using full install instead of ci for bun.lock compatibility
- Port availability validation before deployment
- ESLint errors: unescaped entities, unused imports, type safety issues
- Dashboard and statistics pages now use dynamic rendering instead of static generation

### Changed
- Deployment port from 3001 to 3002 to avoid conflicts with existing applications
- npm install strategy to include devDependencies for successful build
- TypeScript configuration to exclude `___OLD_SITE` and `tests` directories

## [1.0.1] - 2025-09-30

### Added
- Complete production deployment infrastructure for VPS Hostinger
- Automated deploy script (`scripts/deploy.sh`) with SSH support
- Quick update script (`scripts/update-remote.sh`) for fast deployments
- Deployment health check script (`scripts/check-deployment.sh`)
- Comprehensive deployment guide (`DEPLOY.md`) with step-by-step instructions
- Nginx configuration example (`nginx.conf.example`)
- PM2 ecosystem configuration for process management
- Production deploy section in README.md

### Successfully Deployed
- ✅ Application running on VPS at port 3002
- ✅ PM2 managing process with auto-restart
- ✅ Database migrated and functional
- ✅ All endpoints responding (HTTP 200)
- ✅ Memory usage: 101MB (well within 700MB limit)

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
