#!/usr/bin/env node
/**
 * UserPromptSubmit Hook - Save user prompts to CSV or handle feedback
 * Cross-platform Node.js version
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Read input data from stdin
let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('readable', () => {
    let chunk;
    while (null !== (chunk = process.stdin.read())) {
        inputData += chunk;
    }
});

process.stdin.on('end', () => {
    processInput(inputData);
});

function processInput(input) {
    try {
        // Extract necessary information
        const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace('T', ' ');
        const projectPath = process.cwd();

        // Parse input JSON
        let parsedInput = {};
        try {
            parsedInput = JSON.parse(input);
        } catch (e) {
            // If parsing fails, treat entire input as user prompt
        }

        // Extract session ID or generate new one
        let sessionId = parsedInput.session_id || '';
        if (!sessionId) {
            sessionId = crypto.randomUUID().toLowerCase();
        }

        // Extract user prompt
        let userPrompt = parsedInput.user_input || parsedInput.prompt || '';
        if (!userPrompt) {
            userPrompt = input;
        }

        // Project ccptracker directory paths
        const scriptDir = __dirname;
        const ccptrackerDir = path.dirname(scriptDir);
        const sessionFile = path.join(ccptrackerDir, 'temp', 'current-session.json');
        const logFile = path.join(ccptrackerDir, 'logs', 'user-prompt-submit-debug.log');

        // Ensure necessary directories exist
        fs.mkdirSync(path.join(ccptrackerDir, 'temp'), { recursive: true });
        fs.mkdirSync(path.join(ccptrackerDir, 'logs'), { recursive: true });
        fs.mkdirSync(path.join(ccptrackerDir, 'data'), { recursive: true });

        // Check feedback pattern (numbers 1-5 only)
        const trimmedPrompt = userPrompt.trim();

        // Debug log
        const debugLog = [
            '=== User Prompt Submit Debug ===',
            `Time: ${timestamp}`,
            `USER_PROMPT: [${userPrompt}]`,
            `TRIMMED_PROMPT: [${trimmedPrompt}]`,
            `Pattern match: ${/^[1-5]$/.test(trimmedPrompt) ? 'YES' : 'NO'}`,
            `SESSION_FILE exists: ${fs.existsSync(sessionFile) ? 'YES' : 'NO'}`
        ];

        if (fs.existsSync(sessionFile)) {
            debugLog.push('SESSION_FILE content:');
            try {
                const sessionContent = fs.readFileSync(sessionFile, 'utf8');
                debugLog.push(sessionContent);
            } catch (e) {
                debugLog.push('Error reading session file');
            }
        }
        debugLog.push('');

        fs.appendFileSync(logFile, debugLog.join('\n'), 'utf8');

        // Check if input is a satisfaction rating (1-5)
        if (/^[1-5]$/.test(trimmedPrompt)) {
            // Check previous session information
            if (fs.existsSync(sessionFile)) {
                try {
                    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
                    const prevSessionId = sessionData.session_id;

                    if (prevSessionId) {
                        // Log previous session ID
                        fs.appendFileSync(logFile, `PREV_SESSION_ID: [${prevSessionId}]\n`, 'utf8');

                        // Save feedback using csv-updater.js
                        const csvUpdaterPath = path.join(scriptDir, 'csv-updater.js');
                        const args = ['update-satisfaction', prevSessionId, trimmedPrompt, ''];

                        spawn('node', [csvUpdaterPath, ...args], {
                            stdio: ['ignore', 'ignore', 'ignore'],
                            detached: false
                        });

                        // Log satisfaction save
                        fs.appendFileSync(logFile, `Satisfaction saved for session: ${prevSessionId}\n`, 'utf8');

                        // Delete session information
                        fs.unlinkSync(sessionFile);

                        // Block Claude call and show success message
                        console.log(JSON.stringify({
                            decision: "block",
                            reason: `✅ Satisfaction rating saved (${trimmedPrompt}/5)`
                        }));
                        process.exit(0);
                    }
                } catch (e) {
                    // Session file exists but can't be parsed
                }
            }

            // No valid session file - show guidance message
            fs.appendFileSync(logFile, 'No session file - feedback ignored\n', 'utf8');
            console.log(JSON.stringify({
                decision: "block",
                reason: "⚠️ No conversation to rate. Please enter a question first."
            }));
            process.exit(0);
        }

        // Handle regular prompt: save session information to temporary file
        const sessionInfo = {
            session_id: sessionId,
            timestamp: timestamp,
            project_path: projectPath
        };

        fs.writeFileSync(sessionFile, JSON.stringify(sessionInfo, null, 2), 'utf8');

        // Add new row to CSV using csv-updater.js
        const csvUpdaterPath = path.join(scriptDir, 'csv-updater.js');
        const args = ['add', sessionId, timestamp, projectPath, userPrompt];

        const child = spawn('node', [csvUpdaterPath, ...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        child.stdout.on('data', (data) => {
            process.stdout.write(data);
        });

        child.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        child.on('close', (code) => {
            process.exit(code);
        });

    } catch (error) {
        console.error('Error in user-prompt-submit hook:', error.message);
        process.exit(1);
    }
}
