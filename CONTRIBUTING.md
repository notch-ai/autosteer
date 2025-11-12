# Contributing to AutoSteer

Thank you for your interest in contributing to AutoSteer! We welcome contributions from the community and are excited to work with you.

## Code of Conduct

Please be respectful and constructive in all interactions. We strive to maintain a welcoming and inclusive environment for all contributors.

## How to Contribute

### Reporting Issues

- **Search existing issues** before creating a new one to avoid duplicates
- **Use issue templates** when available
- **Provide detailed information** including:
  - Your operating system and version
  - AutoSteer version
  - Steps to reproduce the issue
  - Expected vs actual behavior
  - Screenshots or error logs when applicable

### Feature Requests

- Check existing issues for similar requests
- Describe the problem your feature would solve
- Provide use cases and examples
- Be open to discussion about implementation approaches

### Pull Requests

#### Before You Start

1. **Fork the repository** and create a new branch from `main`
2. **Discuss major changes** by opening an issue first
3. **Check existing PRs** to avoid duplicate work
4. **Set up your development environment** (see Development Setup below)

#### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/autosteer.git
cd autosteer

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

#### Making Changes

1. **Follow existing code style** - We use Prettier for formatting
2. **Write meaningful commit messages** using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `style:` for formatting changes
   - `refactor:` for code refactoring
   - `test:` for test additions or changes
   - `chore:` for maintenance tasks

3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Run tests and linting** before committing:
   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

#### Submitting Your PR

1. **Push your changes** to your fork
2. **Create a pull request** with:
   - Clear title describing the change
   - Detailed description of what and why
   - Reference to related issues using `Fixes #123` or `Relates to #123`
   - Screenshots for UI changes
3. **Respond to review feedback** promptly
4. **Keep your PR up to date** with the main branch

### Code Style Guidelines

- **TypeScript** for all new code
- **React** components should be functional with hooks
- **Tailwind CSS** for styling
- **ESLint** and **Prettier** for code quality
- Follow the existing patterns in the codebase

### Testing

We use Jest and Playwright for testing. Write tests for all new functionality:

- **Unit tests** (`pnpm test:unit`) - For utilities, services, hooks, and business logic
- **Integration tests** (`pnpm test:integration`) - For critical workflows and cross-component interactions
- **Component tests** (`pnpm test:component`) - Playwright component testing for UI components
- **Visual tests** (`pnpm test:visual`) - Visual regression testing with Playwright
- **E2E tests** (`pnpm test:e2e`) - For end-to-end user workflows
- **Performance tests** - For benchmarking and performance-critical code

Run all tests before submitting:
```bash
pnpm test              # Run all tests
pnpm test:unit         # Run unit tests only
pnpm test:integration  # Run integration tests only
pnpm test:component    # Run Playwright component tests
pnpm test:visual       # Run visual regression tests
pnpm test:e2e          # Run E2E tests only
pnpm test:coverage     # Run tests with coverage report
```

Manual testing checklist for PRs:
- [ ] App starts without errors
- [ ] Basic navigation works
- [ ] No console errors in development
- [ ] Changes work as expected
- [ ] Terminal functionality works (if applicable)
- [ ] Git operations work (if applicable)
- [ ] Session persistence works (save/restore)
- [ ] Test on multiple platforms (macOS, Linux, Windows via WSL) when possible
- [ ] Visual regression tests pass (for UI changes)

### Documentation

- Update README.md for user-facing changes
- Add inline comments for complex logic
- Keep documentation concise and up-to-date

## Project Structure

```
autosteer/
├── src/
│   ├── main/                     # Electron main process
│   │   ├── ipc/                  # IPC handlers (claude, project, git, system)
│   │   ├── services/             # Main process services
│   │   └── windows/              # Window management
│   ├── features/                 # Domain-based feature organization
│   │   ├── chat/                 # Chat feature domain (15 components)
│   │   ├── monitoring/           # Monitoring feature domain (10 components)
│   │   ├── settings/             # Settings feature domain (4 components)
│   │   └── shared/               # Shared components across features (48 components)
│   │       └── components/       # Organized by subdomain (agent, git, layout, etc.)
│   ├── components/               # Common UI primitives (shadcn/ui)
│   ├── services/                 # Renderer process services
│   ├── stores/                   # State management (Zustand + Immer)
│   ├── hooks/                    # React hooks (useCodeMirror, useTerminalPool)
│   ├── commons/                  # Shared utilities
│   │   ├── utils/                # Utility functions
│   │   ├── contexts/             # React contexts
│   │   └── config/               # Configuration
│   ├── entities/                 # Data models
│   ├── types/                    # TypeScript types
│   └── views/                    # Top-level view components
├── tests/
│   ├── unit/                     # Unit tests (organized by feature path)
│   ├── integration/              # Integration tests
│   ├── component/                # Playwright component tests
│   └── e2e/                      # E2E tests
├── assets/                       # App icons and images
├── scripts/                      # Build and release scripts
└── .github/workflows/            # CI/CD configuration
```

## Release Process

We use [Release Please](https://github.com/googleapis/release-please) for automated versioning and releases:

1. PRs are merged to `main` with conventional commit messages
2. Release Please creates/updates a release PR automatically
3. When the release PR is merged, it:
   - Updates version numbers in `package.json`
   - Creates a git tag for the release
   - Creates a GitHub release with release notes
4. The build workflow must be triggered manually to create platform-specific installers

Note: We do not generate a `CHANGELOG.md` file. All release notes are maintained on GitHub releases only.

## Recognition

Contributors will be recognized in:

- Release notes
- GitHub contributors page

## License

By contributing to AutoSteer, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to AutoSteer! Your efforts help make this project better for everyone. 🚀
