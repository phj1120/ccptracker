#!/usr/bin/env node
/**
 * Stop Hook - Update CSV when Claude response is completed
 * Cross-platform Node.js version (Windows, macOS, Linux compatible)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

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
      message: `Error in stop hook: ${error.message}`
    }));
    process.exit(0);
  }
});

async function main(input) {
  const globalDir = path.join(os.homedir(), '.ccptracker');
  const tempDir = path.join(globalDir, 'temp');
  const logsDir = path.join(globalDir, 'logs');

  // Ensure directories exist
  [tempDir, logsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Debug log
  const debugLog = `=== Stop Hook Debug Log ===
Time: ${new Date().toISOString()}

Input JSON:
${input}

`;
  fs.appendFileSync(path.join(logsDir, 'stop-hook-debug.log'), debugLog);

  // Load session information
  const sessionFile = path.join(tempDir, 'current-session.json');
  if (!fs.existsSync(sessionFile)) {
    // Exit if no session information
    process.exit(0);
  }

  const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  const sessionId = sessionData.session_id;

  // Parse input JSON
  let inputJson = {};
  let transcriptPath = '';

  try {
    inputJson = JSON.parse(input);
    transcriptPath = inputJson.transcript_path || '';
  } catch (e) {
    // Continue even if parsing fails
  }

  // Extract response content from transcript
  let claudeResponse = '';
  let toolsUsed = '';
  let toolsCount = 0;
  let modelId = '';
  let usageJson = '{}';

  if (transcriptPath && fs.existsSync(transcriptPath)) {
    try {
      const parseTranscriptScript = path.join(globalDir, 'hooks', 'stop-parse-transcript.js');
      const parseResult = require(parseTranscriptScript);
      const hookSessionId = inputJson.session_id || '';

      const result = await parseResult.parseTranscript(transcriptPath, hookSessionId);
      claudeResponse = result.response || '';
      toolsUsed = result.tools_used || '';
      toolsCount = result.tools_count || 0;
      modelId = result.model || '';
      usageJson = JSON.stringify(result.usage || {});

      // Debug: parsing results
      const debugParsing = `
Parsed response length: ${claudeResponse.length}
Response preview: ${claudeResponse.substring(0, 200)}
Tools used: ${toolsUsed}
Tools count: ${toolsCount}
Model: ${modelId}
Usage JSON: ${usageJson}
Session ID: ${hookSessionId}
`;
      fs.appendFileSync(path.join(logsDir, 'stop-hook-debug.log'), debugParsing);
    } catch (e) {
      fs.appendFileSync(path.join(logsDir, 'stop-hook-debug.log'), `\nError parsing transcript: ${e.message}\n`);
    }
  } else {
    fs.appendFileSync(path.join(logsDir, 'stop-hook-debug.log'), `\nTranscript not found: ${transcriptPath}\n`);
  }

  // Calculate elapsed time
  const startTime = new Date(sessionData.timestamp);
  const endTime = new Date();
  const duration = Math.floor((endTime - startTime) / 1000);

  // Update CSV with response information
  const csvUpdater = require(path.join(globalDir, 'hooks', 'csv-updater.js'));
  let usageData = {};
  try {
    usageData = JSON.parse(usageJson);
  } catch (e) {
    // Continue with empty usage data
  }
  await csvUpdater.updateResponse(sessionId, claudeResponse, duration, toolsUsed, toolsCount, modelId, usageData);

  // Save current response session information (for next satisfaction rating)
  const updatedSessionData = {
    session_id: sessionId,
    timestamp: endTime.toISOString().replace('T', ' ').substring(0, 19),
    project_path: sessionData.project_path,
    project_name: sessionData.project_name
  };
  fs.writeFileSync(sessionFile, JSON.stringify(updatedSessionData, null, 2), 'utf8');

  // Feedback guidance message
  console.log(JSON.stringify({
    decision: 'proceed',
    message: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Rate satisfaction: Enter 1-5 in next prompt\n[1] ⭐ Very Poor [2] ⭐⭐ Poor [3] ⭐⭐⭐ Average\n[4] ⭐⭐⭐⭐ Good [5] ⭐⭐⭐⭐⭐ Excellent\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  }));

  process.exit(0);
}
