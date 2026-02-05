# Aider + Gemini Setup Guide

This guide configures **aider** as the CLI interface for Gemini in the dual-agent workflow.

---

## 1. Install aider

```bash
# Using pip (recommended)
pip install aider-chat

# Or using pipx (isolated environment)
pipx install aider-chat

# Verify installation
aider --version
```

---

## 2. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Copy the key

---

## 3. Configure Environment

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, or Windows env vars):

```bash
# Linux/Mac
export GEMINI_API_KEY="your-api-key-here"

# Windows PowerShell (run as admin)
[System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'your-api-key-here', 'User')

# Or add to .env file in project root
echo "GEMINI_API_KEY=your-api-key-here" >> .env
```

---

## 4. Recommended Gemini Models

| Model | Best For | Speed |
|-------|----------|-------|
| `gemini/gemini-2.0-flash-exp` | Fast iteration, quick tasks | Fastest |
| `gemini/gemini-1.5-pro-latest` | Complex architecture, detailed specs | Medium |
| `gemini/gemini-1.5-pro` | Production quality, stable | Medium |

---

## 5. Basic Usage

### Architecture Mode (Gemini writes specs)
```bash
# Navigate to project
cd "C:\Users\jaker\Construction-Management-Software"

# Start aider with Gemini for architecture work
aider --model gemini/gemini-1.5-pro-latest \
  --read CLAUDE.md \
  --read docs/CONSTRUCTION_STANDARDS.md \
  --file .architect_vision.md
```

### Interactive Session
```bash
# Full session with file context
aider --model gemini/gemini-2.0-flash-exp \
  --read ROADMAP_DETAILED.md \
  --read AI_BRIDGE.json
```

---

## 6. Aider Commands

Inside an aider session:

| Command | Description |
|---------|-------------|
| `/add <file>` | Add file to edit context |
| `/read <file>` | Add file as read-only context |
| `/drop <file>` | Remove file from context |
| `/undo` | Undo last file change |
| `/diff` | Show pending changes |
| `/commit` | Commit changes with message |
| `/exit` | Exit aider |

---

## 7. Dual-Agent Workflow

### Step 1: Gemini Architecture (via aider)
```bash
aider --model gemini/gemini-1.5-pro-latest \
  --file .architect_vision.md \
  --read CLAUDE.md \
  --message "Write technical spec for Mobile PWA (Phase 1.1) per ROADMAP_DETAILED.md"
```

### Step 2: Claude Implementation (via claude CLI)
```bash
claude --file .architect_vision.md \
  "Implement the backend per the spec in .architect_vision.md"
```

### Step 3: Gemini Review
```bash
aider --model gemini/gemini-2.0-flash-exp \
  --read .architect_vision.md \
  --read AI_BRIDGE.json \
  --message "Review implementation and update AI_BRIDGE.json with approval status"
```

---

## 8. Testing Integration (Chrome DevTools MCP)

Chrome DevTools MCP is already configured in `.mcp.json`. After implementation:

```bash
# Claude can use Chrome DevTools for testing
claude "Test the Mobile PWA implementation using Chrome DevTools MCP"
```

---

## 9. Troubleshooting

### "API key not found"
```bash
# Check if key is set
echo $GEMINI_API_KEY

# Or in PowerShell
$env:GEMINI_API_KEY
```

### "Model not found"
```bash
# List available models
aider --list-models gemini/
```

### "Rate limited"
- Gemini has generous free tier limits
- If hit, wait 60 seconds or upgrade to paid tier

---

## 10. Quick Reference

```bash
# Architecture task
aider -m gemini/gemini-1.5-pro-latest -f .architect_vision.md --message "Your task here"

# Quick review
aider -m gemini/gemini-2.0-flash-exp --read file.ts --message "Review this code"

# No git commits (for experimentation)
aider --no-auto-commits --model gemini/gemini-2.0-flash-exp
```

---

*Last updated: 2026-02-04*
