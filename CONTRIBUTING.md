# Contributing to FGATIR Rater Study

Thank you for contributing! This document outlines the process for development, testing, and submitting changes.

## Development Environment Setup

### Prerequisites

- Node.js 22.x (use `nvm use` if you have nvm installed, or see `.nvmrc`)
- npm 10.x+

### Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd fgatir-rater

# Install dependencies
npm install --legacy-peer-deps

# Copy environment config
cp .env.example .env

# Start the dev server
npm run dev
```

### Why `--legacy-peer-deps`?

Some Cornerstone3D packages have peer dependency conflicts with React 19. Using `--legacy-peer-deps` allows installation without errors. This is safe for our use case.

## Running Tests

```bash
# Unit & component tests
npm run test

# Tests in watch mode (during development)
npm run test:watch

# E2E tests (requires Playwright browsers)
npx playwright install chromium
npm run test:e2e

# Full CI check (typecheck + lint + test + build)
npm run check
```

All tests must pass before submitting a PR. The CI pipeline enforces this.

## Code Style

### ESLint + Prettier

The project uses ESLint for linting and Prettier for formatting:

```bash
# Check for lint issues
npm run lint

# Format code (via editor integration or manually)
npx prettier --write "src/**/*.{ts,tsx}"
```

### Key Style Rules

- Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess`)
- Zero unused locals/parameters
- React Hooks rules enforced
- No `any` without explicit justification

### Editor Setup

Recommended VS Code extensions:
- ESLint
- Prettier
- TypeScript Vue Plugin (Volar) — for TypeScript support

## Commit Message Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `chore` | Tooling, dependencies, build changes |

### Examples

```
feat(rating): add keyboard shortcut for Likert scale selection
fix(session): prevent duplicate session saves on rapid clicks
docs(readme): update browser compatibility table
test(blinding): add test for display label neutrality
```

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following the code style guidelines above.

3. **Run the full check suite** before pushing:
   ```bash
   npm run check
   ```

4. **Push and open a PR** against `main`.

5. **PR Requirements**:
   - All CI checks pass (typecheck, lint, test, build)
   - New features include tests
   - Documentation updated if needed
   - No `console.log` statements (use the DiagnosticPanel for debug output)

6. **Review**: At least one approving review is required before merge.

## Architecture Notes

### Blinding is Critical

This is a blinded study. **Never** introduce code that reveals whether a series is "original" or "denoised" in the rater-facing UI. All condition information is isolated to:
- The ingestion script (strips it)
- The unblinding export script (admin-only, post-study)

### Test Coverage

When adding features, add tests for:
- Service layer logic (unit tests in `src/tests/`)
- Component behavior (React Testing Library)
- Integration flows (Playwright E2E when applicable)

## Questions?

Contact the project lead before making significant architectural changes.
