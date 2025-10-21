# AutoSteer

[![Release](https://img.shields.io/github/v/release/notch-ai/autosteer)](https://github.com/notch-ai/autosteer/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows%20(WSL)-lightgrey)](https://github.com/notch-ai/autosteer/releases)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-green)](https://nodejs.org)

AutoSteer is a desktop application that enhances your Claude Code experience with multi-workspace management. Built with Electron, it works across macOS, Linux, and Windows (via WSL), allowing you to manage multiple isolated workspaces with persistent sessions and seamless context switching.

## Demo

https://github.com/user-attachments/assets/869df7cd-a880-427f-9b3f-124cb1630b27


> [!NOTE]
> This project is not affiliated with, endorsed by, or sponsored by Anthropic. Claude is a trademark of Anthropic, PBC. This is an independent project using Claude.

## Features

- Worktree-First Architecture - Organize projects in isolated workspaces with independent file systems and contexts
- Persistent Sessions - Save and resume conversations per worktree, maintaining full context across work sessions
- Multi-Project Management - Switch seamlessly between different projects without losing state or context
- Cross-Platform - Native support for macOS, Linux, and Windows (via WSL)
- Context Preservation - Automatically saves conversation state, allowing you to pick up exactly where you left off
- Fast Context Switching - Instantly switch between worktrees
- Token Usage Tracking - Monitor token usage and costs per message and per worktree
- Status Panel - View session information, manage MCP servers, and handle MCP authentication

## 📦 Installation

**Prerequisite:** [Claude Code](https://docs.claude.com/en/docs/claude-code/quickstart) must be installed first.

### Quick Install

Download the latest version for your platform from the [Releases](https://github.com/notch-ai/autosteer/releases) page:

- **macOS**: Download `.zip` file and extract to Applications
- **Linux**: Download `.deb` (Debian/Ubuntu) or `.rpm` (Fedora/RHEL)
- **Windows**: Install via WSL2 (see below)

### Platform-Specific Instructions

For detailed installation instructions including WSL2 setup for Windows, see [INSTALLATION.md](INSTALLATION.md)

## 🚀 Getting Started

```bash
# Launch AutoSteer
autosteer

# Launch with debug logging
autosteer --debug
```

After launching, configure your preferences in Settings and start using Claude Code with AutoSteer!

AutoSteer stores configuration in `~/.autosteer/` on all platforms.

## 🛠️ Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or higher)
- [pnpm](https://pnpm.io/) (v8 or higher)
- [Git](https://git-scm.com/)
- Platform-specific build tools:
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `build-essential` package
  - **Windows**: Use WSL with Linux build tools (see [INSTALLATION.md](INSTALLATION.md))

### Building from Source

```bash
# Clone the repository
git clone https://github.com/notch-ai/autosteer.git
cd autosteer

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Run tests
pnpm test

# Build application
pnpm compile

# Package for distribution
pnpm make
```

### Development Scripts

```bash
# Start development server
pnpm dev

# Run unit tests
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run all tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Type check
pnpm typecheck

# Compile application (TypeScript + Webpack)
pnpm compile

# Package application for current platform
pnpm package

# Create distributable installers
pnpm make
```

### Project Structure

```text
autosteer/
├── src/
│   ├── main/           # Electron main process
│   ├── components/     # React UI components
│   ├── features/       # Feature modules
│   ├── services/       # Application services
│   ├── stores/         # State management
│   ├── hooks/          # React hooks
│   ├── commons/        # Shared utilities
│   ├── entities/       # Data models
│   └── types/          # TypeScript types
├── assets/             # App icons and images
├── tests/              # Test files
├── scripts/            # Build and release scripts
└── .github/workflows/  # CI/CD configuration
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for detailed information.

### Quick Start for Contributors

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/autosteer.git
cd autosteer

# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests before committing
pnpm test
pnpm lint
pnpm typecheck
```

## 🧪 Testing

### Running Tests

We use Jest for testing:

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:integration

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

## 🔒 Security

1. **Process Isolation**: Agents run in separate processes
2. **Local Storage**: All data stays on your machine
3. **No Telemetry**: No data collection or tracking

## 🔧 Troubleshooting

### Getting Help

- 🐛 Report bugs via [GitHub Issues](https://github.com/notch-ai/autosteer/issues)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
