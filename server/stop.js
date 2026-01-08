/**
 * Stop Server Script
 * Safely stops the running server using the PID file.
 * This only kills the server process, not other node processes.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PID_FILE = path.join(__dirname, '..', 'server.pid');

function stopServer() {
  if (!fs.existsSync(PID_FILE)) {
    console.log('No server.pid file found - server may not be running');
    return false;
  }

  const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
  console.log(`Found server PID: ${pid}`);

  try {
    // Check if process exists
    if (process.platform === 'win32') {
      // Windows: use taskkill with specific PID
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
    } else {
      // Unix: use kill
      process.kill(parseInt(pid), 'SIGTERM');
    }
    console.log(`Server (PID ${pid}) stopped successfully`);

    // Clean up PID file
    try {
      fs.unlinkSync(PID_FILE);
    } catch (e) {}

    return true;
  } catch (err) {
    if (err.message?.includes('not found') || err.code === 'ESRCH') {
      console.log(`Process ${pid} not found - cleaning up stale PID file`);
      try {
        fs.unlinkSync(PID_FILE);
      } catch (e) {}
      return false;
    }
    console.error(`Failed to stop server: ${err.message}`);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  stopServer();
}

module.exports = { stopServer };
