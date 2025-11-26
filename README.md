# AutoSteer

[![Release](https://img.shields.io/github/v/release/notch-ai/autosteer)](https://github.com/notch-ai/autosteer/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows%20(WSL)-lightgrey)](https://github.com/notch-ai/autosteer/releases)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-green)](https://nodejs.org)

AutoSteer is a desktop application that enhances your Claude Code experience with multi-workspace management. Built with Electron, it works across macOS, Linux, and Windows (via WSL), allowing you to manage multiple isolated workspaces with persistent sessions and seamless context switching.

## Demo

https://github.com/user-attachments/assets/65219ff1-f600-412a-8a5f-fe7a1880704f



> [!NOTE]
> This project is not affiliated with, endorsed by, or sponsored by Anthropic. Claude is a trademark of Anthropic, PBC. This is an independent project using Claude.

## Features

- Worktree-First Architecture - Organize projects in isolated workspaces with independent file systems and contexts
- Persistent Sessions - Save and resume conversations per worktree, maintaining full context across work sessions
- Multi-Project Management - Switch seamlessly between different projects without losing state or context
- Per-Project Tab Management - Session tabs scoped to projects with auto-select behavior and persistent state
- Cross-Platform - Native support for macOS, Linux, and Windows (via WSL)
- Context Preservation - Automatically saves conversation state, allowing you to pick up exactly where you left off
- Fast Context Switching - Instantly switch between worktrees and tabs
- Token Usage Tracking - Monitor token usage and costs per message and per worktree
- Status Panel - View session information, manage MCP servers, and handle MCP authentication
- Protocol Trace Viewer - Inspect detailed protocol messages for debugging and understanding agent behavior
- Custom Slash Commands - Extend Claude Code functionality with custom command patterns (file:src/commons/utils/slashCommandUtils.ts)

## 📦 Installation

**Prerequisite:** [Claude Code](https://docs.claude.com/en/docs/claude-code/quickstart) must be installed first.

### Quick Install

Download the latest version for your platform from the [Releases](https://github.com/notch-ai/autosteer/releases) page:

- **macOS**: Download `.zip` file and extract to Applications
- **Linux**: Download `.deb` (Debian/Ubuntu) or `.rpm` (Fedora/RHEL)
- **Windows**: Install via WSL2

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
- [pnpm](https://pnpm.io/) (v9 or higher)
- [Git](https://git-scm.com/)
- Platform-specific build tools:
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `build-essential` package
  - **Windows**: Use WSL with Linux build tools

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
│   ├── main/                           # Electron main process
│   │   └── ipc/                        # Inter-process communication layer
│   │       ├── handlers/               # 4 consolidated domain handlers
│   │       │   ├── claude.handlers.ts  # Agent, MCP, SlashCommand operations
│   │       │   ├── project.handlers.ts # File, Resource management
│   │       │   ├── git.handlers.ts     # Git operations
│   │       │   └── system.handlers.ts  # Terminal, Badge, Config, Log, Store, Update
│   │       ├── utils/handlerFactory.ts # Reusable error handling, logging, validation
│   │       └── IpcRegistrar.ts         # Centralized handler registration
│   ├── features/                       # Domain-based feature organization
│   │   ├── chat/                       # Chat feature domain (15 components)
│   │   ├── monitoring/                 # Monitoring feature domain (10 components)
│   │   ├── settings/                   # Settings feature domain (4 components)
│   │   └── shared/                     # Shared components across features (48 components)
│   │       └── components/             # Organized by subdomain
│   │           ├── agent/
│   │           ├── git/
│   │           ├── layout/
│   │           ├── projects/
│   │           ├── session/
│   │           ├── tasks/
│   │           ├── terminal/
│   │           └── ui/
│   ├── components/                     # Common UI layer (shadcn/ui primitives)
│   ├── services/                       # Application services
│   ├── stores/                         # State management (Zustand)
│   ├── hooks/                          # React hooks
│   │   └── useSessionTabs.ts           # Tab management hook 
│   ├── commons/
│   │   ├── utils/                      # Utility functions
│   │   │   └── slash-commands/         # Slash command utilities
│   │   ├── contexts/                   # React contexts
│   │   ├── constants/                  # Constants and config
│   │   │   └── tabs.ts                 # Tab constants (MAX_TABS, system tab IDs)
│   │   └── config/                     # Theme and styling
│   ├── entities/                       # Data models (Lite Clean Architecture)
│   ├── types/                          # TypeScript types
│   │   └── ui.types.ts                 # Tab type definitions (SessionTab, MaximizeTab, TabState)
│   └── docs/                           # Documentation
│       └── tab-management.md           # Tab management guide
├── assets/                             # App icons and images
├── tests/
│   ├── unit/                           # Unit tests (80% coverage target)
│   ├── integration/                    # Integration tests
│   ├── component/                      # Playwright component tests
│   └── factories/                      # Test data factories
├── scripts/                            # Build and release scripts
└── playwright-component.config.ts      # Component testing config
```

**Import Pattern**: `@/features/[domain]/components/[Component]`

### Tab Management

AutoSteer provides robust tab management with per-project isolation. See `docs/tab-management.md` for detailed documentation.

**Key Features**:
- Per-project tab isolation: Only tabs for the selected project are visible
- Auto-select behavior: Automatically switches to another tab when closing
- Persistent state: Tab selection survives application restarts
- System tabs: Terminal and Changes tabs always present
- Maximize tabs: Dynamic tabs for maximize view

**Configuration**:
```json
{
  "settings": {
    "confirmSessionTabDeletion": true
  }
}
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

We use Jest for unit/integration tests and Playwright for component/visual tests:

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

### Test Coverage

Key test files covering critical functionality:

- **Utilities**: `tests/unit/commons/utils/slash-commands/slash_command_utils.test.ts` - Custom slash command formatting
- **Hooks**: `tests/unit/hooks/useTerminalPool.test.ts` - Terminal pool management
- **IPC Handlers**: `tests/unit/main/ipc/handlers/` - Consolidated domain handlers 
- **Services**: `tests/unit/services/ClaudeCodeService.test.ts` - Core Claude Code integration
- **Store**: `tests/unit/stores/core.test.ts` - State management
- **Types**: `tests/unit/types/terminal.types.test.ts` - Terminal type safety
- **Entities**: `tests/unit/entities/SessionBlock.test.ts` - Data model validation

## 🔍 Trace File Format

AutoSteer creates trace files for debugging SDK message flow. These files are stored in `~/.autosteer/traces/` and use JSONL format (one JSON object per line).

### Trace File Location

```
~/.autosteer/traces/{sessionId}.trace.jsonl
```

### Trace Entry Format

Each trace entry is a JSON object with the following structure:

```typescript
{
  "timestamp": "2025-11-09T18:51:35.123Z",    // ISO 8601 timestamp
  "sessionId": "session-abc123",              // Session identifier
  "direction": "to-claude" | "from-claude",   // Message direction
  "rawMessage": { /* SDK message object */ }, // Complete SDK message
  "sdkVersion": "^0.1.0",                     // SDK version
  "correlationId": "550e8400-e29b-41d4",      // Request/response correlation
  "sequenceNumber": 42                         // Monotonic sequence per session
}
```

### Trace File Lifecycle

- **Creation**: Trace files are created automatically when SDK messages are logged
- **Rotation**: Files are rotated when they exceed 100MB, with timestamp suffixes
- **Cleanup**: Trace files are automatically deleted when their project is deleted
- **Manual Cleanup**: Delete files in `~/.autosteer/traces/` to free disk space

### Using Trace Files

Trace files are useful for:
- **Debugging**: Inspect exact SDK messages sent and received
- **Performance Analysis**: Track message timing and sequence
- **Error Investigation**: Review message flow leading to errors
- **SDK Updates**: Verify message format changes across SDK versions

### Example Trace Entry

```json
{
  "timestamp": "2025-11-09T18:51:35.123Z",
  "sessionId": "session-abc123",
  "direction": "from-claude",
  "rawMessage": {
    "type": "assistant",
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "session_id": "session-abc123",
    "message": {
      "role": "assistant",
      "content": [{ "type": "text", "text": "Hello!" }]
    }
  },
  "sdkVersion": "^0.1.0",
  "correlationId": "550e8400-e29b-41d4",
  "sequenceNumber": 42,
  "messageType": "assistant",
  "messageSubtype": null
}
```

## 🔄 SDK Migration Guide

### Overview

This guide helps developers handle Anthropic Claude SDK updates and Pydantic model changes without breaking existing message validation.

### SDK Version Updates

When updating `@anthropic-ai/claude-agent-sdk`:

1. **Check for Breaking Changes**
   - Review SDK release notes for breaking changes
   - Test validation with new SDK types
   - Update Pydantic models if needed

2. **Update Zod Schemas**
   - Location: `src/services/MessageValidator.ts`
   - Match schemas to new SDK types
   - Maintain backward compatibility with relaxed validation

3. **Test Validation**
   ```bash
   pnpm test:unit -- MessageValidator.test.ts
   ```

4. **Update Trace Documentation**
   - Document new message types in README

### Pydantic Model Changes

#### Adding New Message Types

1. **Update Python Models**
   - Follow existing BaseModel pattern
   - Add to `SDKMessage` union type

2. **Update TypeScript Schemas**
   - Add corresponding Zod schema in `MessageValidator.ts`
   - Add to discriminated union
   - Update type guards

3. **Add Tests**
   - Add test cases for new message type
   - Test strict and relaxed validation
   - Test partial extraction

Example:
```typescript
// Add to MessageValidator.ts
const NewMessageTypeSchema = z.object({
  type: z.literal('new_type'),
  uuid: z.string().uuid(),
  session_id: z.string(),
  // ... other fields
});
```

#### Handling Breaking SDK Changes

If an SDK update breaks validation:

1. **Identify Breaking Change**
   - Check validation test failures
   - Review trace logs for error patterns
   - Compare old vs new message structure

2. **Update Schemas Gradually**
   ```typescript
   // Old field (deprecated but still supported)
   old_field: z.string().optional(),

   // New field (preferred)
   new_field: z.string().optional(),
   ```

3. **Add Migration Logic**
   - Handle both old and new formats
   - Log warnings for deprecated fields
   - Gradually phase out old format

4. **Version Compatibility**
   - Track SDK version in trace logs
   - Add version checks if needed
   - Document version requirements

### Testing Migration

```bash
# Run all validation tests
pnpm test:unit -- MessageValidator

# Test with fixtures
pnpm test:integration -- message-validation

# Check type coverage
pnpm typecheck
```

### Rollback Strategy

If validation breaks in production:

1. **Immediate**: Revert to previous SDK version
2. **Short-term**: Deploy hotfix with relaxed validation
3. **Long-term**: Fix schemas and redeploy

### Best Practices

- **Always test with real message fixtures** before deploying
- **Maintain backward compatibility** for at least 2 SDK versions
- **Document breaking changes** in PR descriptions
- **Use relaxed validation** as fallback to prevent crashes
- **Monitor trace logs** for validation failures after updates

## 🔒 Security

1. **Process Isolation**: Agents run in separate processes
2. **Local Storage**: All data stays on your machine
3. **No Telemetry**: No data collection or tracking

## 🔧 Troubleshooting

### Getting Help

- Report bugs via [GitHub Issues](https://github.com/notch-ai/autosteer/issues)
- Request features via [Discussions](https://github.com/notch-ai/autosteer/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.