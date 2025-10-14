#!/usr/bin/env node
/**
 * UserPromptSubmit Hook - Save user prompts to CSV or handle feedback
 * Cross-platform Node.js version (Windows, macOS, Linux compatible)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Simple UUID v4 generator using crypto
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = crypto.randomBytes(1)[0] % 16;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Read input from stdin
let inputData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', async () => {
  try {
    await main(inputData);
  } catch (error) {
    console.error(JSON.stringify({
      decision: 'proceed',
      message: `Error in user-prompt-submit hook: ${error.message}`
    }));
    process.exit(0);
  }
});

async function main(input) {
  const config = require(path.join(os.homedir(), '.ccptracker', 'config.json'));
  const globalDir = path.join(os.homedir(), '.ccptracker');
  const tempDir = path.join(globalDir, 'temp');
  const logsDir = path.join(globalDir, 'logs');
  const dataDir = path.join(globalDir, 'data');

  // Ensure necessary directories exist
  [tempDir, logsDir, dataDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const projectPath = process.cwd();
  const projectName = path.basename(projectPath);

  // Parse input JSON
  let inputJson = {};
  let userPrompt = '';
  let sessionId = '';

  try {
    inputJson = JSON.parse(input);
    userPrompt = inputJson.user_input || inputJson.prompt || '';
    sessionId = inputJson.session_id || '';
  } catch (e) {
    userPrompt = input.trim();
  }

  // Generate session ID if not provided
  if (!sessionId) {
    sessionId = uuidv4();
  }

  // Session file path
  const sessionFile = path.join(tempDir, 'current-session.json');

  // Debug log
  const debugLog = `=== User Prompt Submit Debug ===
Time: ${new Date().toISOString()}
USER_PROMPT: [${userPrompt}]
TRIMMED_PROMPT: [${userPrompt.trim()}]
SESSION_FILE exists: ${fs.existsSync(sessionFile) ? 'YES' : 'NO'}
${fs.existsSync(sessionFile) ? `SESSION_FILE content:\n${fs.readFileSync(sessionFile, 'utf8')}` : ''}

`;
  fs.appendFileSync(path.join(logsDir, 'user-prompt-submit-debug.log'), debugLog);

  // Check if this is a satisfaction rating (1-5)
  const trimmedPrompt = userPrompt.trim();
  const isRating = /^[1-5]$/.test(trimmedPrompt);

  if (isRating) {
    // Check previous session information
    if (fs.existsSync(sessionFile)) {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      const prevSessionId = sessionData.session_id;

      if (prevSessionId) {
        // Save satisfaction rating
        const csvUpdater = require(path.join(globalDir, 'hooks', 'csv-updater.js'));
        await csvUpdater.updateSatisfaction(prevSessionId, trimmedPrompt, '');

        fs.appendFileSync(
          path.join(logsDir, 'user-prompt-submit-debug.log'),
          `Satisfaction saved for session: ${prevSessionId}\n`
        );

        // Delete session information
        fs.unlinkSync(sessionFile);

        // Block Claude call and show message
        console.log(JSON.stringify({
          decision: 'block',
          reason: `✅ Satisfaction rating saved (${trimmedPrompt}/5)`
        }));
        process.exit(0);
      }
    } else {
      // No session file - ignore feedback
      fs.appendFileSync(
        path.join(logsDir, 'user-prompt-submit-debug.log'),
        'No session file - feedback ignored\n'
      );

      console.log(JSON.stringify({
        decision: 'block',
        reason: '⚠️ No conversation to rate. Please enter a question first.'
      }));
      process.exit(0);
    }
  }

  // Handle regular prompt: save session information
  const sessionData = {
    session_id: sessionId,
    timestamp: timestamp,
    project_path: projectPath,
    project_name: projectName
  };
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');

  // Add new row to CSV
  const csvUpdater = require(path.join(globalDir, 'hooks', 'csv-updater.js'));
  await csvUpdater.add(sessionId, timestamp, projectPath, projectName, userPrompt);

  // Proceed normally
  process.exit(0);
}
