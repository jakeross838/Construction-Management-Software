# Multi-Computer Workflow

This project is designed to work seamlessly across multiple computers using GitHub for synchronization.

## Quick Reference

### Starting Work (on any computer)
```cmd
cd "P:\Claude Projects\Construction Management Software"
scripts\sync
npm start
```

### Ending Work (before switching computers)
```cmd
scripts\push
```

---

## Detailed Workflow

### When You Start Working

1. **Always sync first** - Run the sync script before starting:
   ```cmd
   scripts\sync
   ```

   This will:
   - Pull latest changes from GitHub
   - Check if dependencies changed
   - Run `npm install` if needed
   - Report any issues

2. **Start the server**:
   ```cmd
   npm start
   ```

### While Working

- Work normally
- Commit frequently with meaningful messages
- No special steps needed

### When You're Done

1. **Push your changes** before switching computers:
   ```cmd
   scripts\push
   ```

   This will:
   - Show uncommitted changes
   - Prompt for commit message
   - Push to GitHub

2. **Verify push succeeded** - Check the output shows no errors

---

## Manual Commands (if scripts don't work)

### Pull Changes
```cmd
git pull origin main
npm install
cd client && npm install && cd ..
```

### Push Changes
```cmd
git add .
git commit -m "Your message"
git push origin main
```

### Check Status
```cmd
git status
git log --oneline -5
```

---

## Handling Conflicts

If you forget to push on one computer and make changes on another:

1. **Commit your local changes first**:
   ```cmd
   git add .
   git commit -m "Local changes"
   ```

2. **Pull with rebase**:
   ```cmd
   git pull --rebase origin main
   ```

3. **Resolve any conflicts** in your editor

4. **Continue rebase**:
   ```cmd
   git rebase --continue
   ```

5. **Push**:
   ```cmd
   git push origin main
   ```

---

## Environment Files

The `.env` file is **not synced** (for security). If you set up a new computer:

1. Copy `.env.example` to `.env` (if it exists)
2. Or create `.env` with required values:
   ```
   SUPABASE_URL=https://sorghqcpeamdfbvysafj.supabase.co
   SUPABASE_SERVICE_KEY=your-key-here
   ANTHROPIC_API_KEY=your-key-here
   ```

Ask the project owner for API keys if needed.

---

## What Gets Synced

| Synced (tracked) | Not Synced (ignored) |
|------------------|----------------------|
| All source code | `node_modules/` |
| Documentation | `.env` files |
| Package lock files | Build outputs (`dist/`) |
| Database migrations | IDE settings (`.vscode/`) |
| Scripts | Log files |
| Configuration | Temp files |

---

## Troubleshooting

### "Your branch is behind"
Run `scripts\sync` to pull latest changes.

### "Your branch is ahead"
Run `scripts\push` to push your commits.

### Merge Conflicts
1. Open conflicted files in editor
2. Look for `<<<<<<<` markers
3. Choose which changes to keep
4. Remove conflict markers
5. `git add .` and `git commit`

### Dependencies Out of Sync
```cmd
rm -rf node_modules
npm install
cd client && rm -rf node_modules && npm install
```

### Server Won't Start
```cmd
npm run stop
npm start
```

---

## Best Practices

1. **Sync before starting** - Always run `scripts\sync` first
2. **Push before stopping** - Always run `scripts\push` when done
3. **Commit often** - Small, frequent commits are easier to manage
4. **Write good messages** - Future you will thank present you
5. **Don't commit secrets** - Keep API keys in `.env`
