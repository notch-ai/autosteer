# Installation Guide

## Prerequisites

- **Node.js**: Version 20.x or higher (verified with `node --version`)
- **pnpm**: Version 9.15.4 or higher (verified with `pnpm --version`)
- **Claude Code**: Install from the [official installation guide](https://docs.claude.com/en/docs/claude-code/quickstart)

## Download Pre-built Binaries

Download the latest version for your platform from the [Releases](https://github.com/notch-ai/autosteer/releases) page:

- **macOS**: Download `.zip` file and extract to Applications
- **Linux**: Download `.deb` (Debian/Ubuntu) or `.rpm` (Fedora/RHEL)
- **Windows**: See [Windows Installation via WSL](#windows-installation-via-wsl) below

## macOS Installation

1. Download the latest `.zip` file from the [releases page](https://github.com/notch-ai/autosteer/releases/latest)
2. Extract the archive
3. Move `AutoSteer.app` to your Applications folder
4. Launch AutoSteer from Applications

## Linux Installation

### Debian/Ubuntu

Download the AutoSteer `.deb` package from the [releases page](https://github.com/notch-ai/autosteer/releases/latest)

```bash
# Install
sudo apt install ./autosteer_*.deb

# Launch
autosteer
```

### Fedora/RHEL

Download the AutoSteer `.rpm` package from the [releases page](https://github.com/notch-ai/autosteer/releases/latest)

```bash
# Install
sudo dnf install ./autosteer_*.rpm

# Or using rpm
sudo rpm -i ./autosteer_*.rpm

# Launch
autosteer
```

## Windows Installation via WSL

AutoSteer requires Windows Subsystem for Linux (WSL2) to run on Windows. WSL2 provides a real Linux environment within Windows where both Claude Code and AutoSteer run natively.

**Requirements:**
- Windows 11 version 21H2 or later
- Virtualization enabled in BIOS (check Task Manager > Performance > CPU for "Virtualization: Enabled")

### Step 1: Install WSL2

1. Right-click the Start button and select **Windows Terminal (Admin)** or **PowerShell (Admin)**

2. Run the installation command:
   ```powershell
   wsl --install
   ```

   This automatically enables required Windows features, installs WSL2, and sets up Ubuntu as the default Linux distribution.

3. **Restart your computer** when prompted (required for WSL2 to work properly)

4. After restart, Ubuntu will launch automatically. Create a Linux username and password when prompted.
   - **Note:** Your password won't be visible as you type (this is normal Linux security behavior)
   - This username doesn't need to match your Windows username
   - Remember this password - you'll need it for administrative commands

For detailed help, see [Microsoft's WSL Installation Guide](https://learn.microsoft.com/en-us/windows/wsl/install)

### Step 2: Update Linux System

1. Open your WSL terminal (search for "Ubuntu" in Windows Start menu or open Windows Terminal and select Ubuntu)

2. Update the package manager:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

   You'll be prompted for the password you created in Step 1.

### Step 3: Install Claude Code in WSL

Install Claude Code using the official installation script:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

For more details, see the [official Claude Code installation guide](https://docs.claude.com/en/docs/claude-code/quickstart).

### Step 4: Install AutoSteer in WSL

1. Download the AutoSteer `.deb` package from the [releases page](https://github.com/notch-ai/autosteer/releases/latest):

2. Install AutoSteer:
   ```bash
   sudo apt install ./autosteer_*.deb
   ```

3. Launch AutoSteer:
   ```bash
   autosteer
   ```

### Accessing Windows Files from WSL

Your Windows drives are automatically mounted at `/mnt/` in WSL:
- C: drive → `/mnt/c/`
- D: drive → `/mnt/d/`

To work on Windows projects:
```bash
# Navigate to a Windows project
cd /mnt/c/Users/YourUsername/Projects

# Launch AutoSteer
autosteer
```

**Note:** For better performance, keep projects in the Linux file system (`/home/username/`) when possible.

### Troubleshooting WSL

If you encounter issues:

1. **Check WSL version**:
   ```bash
   wsl --version
   ```
   Make sure you're using WSL 2 (not WSL 1)

2. **Update WSL**:
   ```powershell
   wsl --update
   ```

For more help, see [WSL Troubleshooting Guide](https://learn.microsoft.com/en-us/windows/wsl/troubleshooting)

## Getting Started

After installation:

1. **Launch** the application
2. **Configure** your preferences in Settings
3. **Start using** Claude Code with AutoSteer!

### Basic Usage

```bash
# Launch AutoSteer
autosteer

# Launch with debug logging
autosteer --debug
```

### Configuration

AutoSteer stores configuration in platform-specific locations:

- **macOS**: `/Users/{username}/.autosteer/`
- **Linux**: `/home/{username}/.autosteer/`
- **Windows (WSL)**: `/home/{username}/.autosteer/` (within your WSL distribution)

## Building from Source

See the [Development section in README.md](README.md#-development) for instructions on building from source.
