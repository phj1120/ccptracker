#!/usr/bin/env node
/**
 * Stop Hook - Update CSV when Claude response is completed
 * Cross-platform Node.js version
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Project ccptracker directory paths
const scriptDir = __dirname;
const ccptrackerDir = path.dirname(scriptDir);

// Ensure necessary directories exist
fs.mkdirSync(path.join(ccptrackerDir, 'temp'), { recursive: true });
fs.mkdirSync(path.join(ccptrackerDir, 'logs'), { recursive: true });
fs.mkdirSync(path.join(ccptrackerDir, 'data'), { recursive: true });

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
    processStopHook(inputData);
});

/**
 * Find transcript file by searching directories recursively
 */
function findTranscriptFile(projectPath) {
    const projectName = path.basename(projectPath);
    const projectPathEncoded = projectPath.replace(/[/\\]/g, '-');
    const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');

    if (!fs.existsSync(claudeProjectsDir)) {
        return '';
    }

    try {
        // Find transcript directory based on project name
        const projectDirs = fs.readdirSync(claudeProjectsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            .filter(name => name.includes(projectName));

        for (const dirName of projectDirs) {
            const dirPath = path.join(claudeProjectsDir, dirName);
            try {
                const files = fs.readdirSync(dirPath)
                    .filter(file => file.endsWith('.jsonl'))
                    .map(file => {
                        const filePath = path.join(dirPath, file);
                        const stat = fs.statSync(filePath);
                        return { path: filePath, mtime: stat.mtime };
                    })
                    .sort((a, b) => b.mtime - a.mtime); // Most recent first

                if (files.length > 0) {
                    return files[0].path;
                }
            } catch (e) {
                // Skip directories we can't read
                continue;
            }
        }

        // If not found by project name, try encoded path
        const encodedDirs = fs.readdirSync(claudeProjectsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            .filter(name => name.includes(projectPathEncoded));

        for (const dirName of encodedDirs) {
            const dirPath = path.join(claudeProjectsDir, dirName);
            try {
                const files = fs.readdirSync(dirPath)
                    .filter(file => file.endsWith('.jsonl'))
                    .map(file => {
                        const filePath = path.join(dirPath, file);
                        const stat = fs.statSync(filePath);
                        return { path: filePath, mtime: stat.mtime };
                    })
                    .sort((a, b) => b.mtime - a.mtime);

                if (files.length > 0) {
                    return files[0].path;
                }
            } catch (e) {
                continue;
            }
        }

        // If still not found, find most recently modified .jsonl file anywhere
        const allJsonlFiles = [];

        function findJsonlRecursive(dir) {
            try {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) {
                        findJsonlRecursive(fullPath);
                    } else if (item.name.endsWith('.jsonl')) {
                        const stat = fs.statSync(fullPath);
                        allJsonlFiles.push({ path: fullPath, mtime: stat.mtime });
                    }
                }
            } catch (e) {
                // Skip directories we can't read
            }
        }

        findJsonlRecursive(claudeProjectsDir);

        if (allJsonlFiles.length > 0) {
            allJsonlFiles.sort((a, b) => b.mtime - a.mtime);
            return allJsonlFiles[0].path;
        }

    } catch (e) {
        // Return empty if any error occurs
    }

    return '';
}

function processStopHook(input) {
    try {
        const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace('T', ' ');

        // Debug: log input data
        const debugLog = [
            '=== Stop Hook Debug Log ===',
            `Time: ${timestamp}`,
            '',
            'Input JSON:',
            input,
            ''
        ].join('\n');

        const logFile = path.join(ccptrackerDir, 'logs', 'stop-hook-debug.log');
        fs.writeFileSync(logFile, debugLog, 'utf8');

        // Load session information
        const sessionFile = path.join(ccptrackerDir, 'temp', 'current-session.json');
        if (!fs.existsSync(sessionFile)) {
            // Exit if no session information (executed without prompt submission)
            process.exit(0);
        }

        const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
        const sessionId = sessionData.session_id;

        // Parse input JSON
        let parsedInput = {};
        try {
            parsedInput = JSON.parse(input);
        } catch (e) {
            // If parsing fails, continue with empty object
        }

        // Extract transcript file path - use exact path from input first
        const originalTranscript = parsedInput.transcript_path || '';
        let transcriptPath = '';

        if (originalTranscript && fs.existsSync(originalTranscript)) {
            transcriptPath = originalTranscript;
        } else {
            // Fallback: find transcript file for current project
            transcriptPath = findTranscriptFile(process.cwd());
        }

        // Get file size for debug
        let fileSize = 0;
        if (transcriptPath && fs.existsSync(transcriptPath)) {
            try {
                fileSize = fs.statSync(transcriptPath).size;
            } catch (e) {
                fileSize = 0;
            }
        }

        // Debug: transcript information
        const transcriptDebug = [
            `Original transcript: ${originalTranscript}`,
            `Using transcript: ${transcriptPath}`,
            `File size: ${fileSize} bytes`
        ].join('\n');

        fs.appendFileSync(logFile, transcriptDebug + '\n', 'utf8');

        // Extract session ID from input JSON (if available)
        const hookSessionId = parsedInput.session_id || '';

        // Extract response content (last assistant message from transcript)
        let claudeResponse = '';
        let toolsUsed = '';
        let toolsCount = 0;
        let modelId = '';
        let usageJson = '{}';

        if (transcriptPath && fs.existsSync(transcriptPath)) {
            // Parse transcript with Node.js script, passing session ID
            const parseTranscriptPath = path.join(scriptDir, 'stop-parse-transcript.js');

            try {
                const result = require('child_process').execSync(
                    `node "${parseTranscriptPath}" "${transcriptPath}" "${hookSessionId}"`,
                    { encoding: 'utf8', timeout: 10000 }
                );

                const parsedResult = JSON.parse(result);
                claudeResponse = parsedResult.response || '';
                toolsUsed = parsedResult.tools_used || '';
                toolsCount = parsedResult.tools_count || 0;
                modelId = parsedResult.model || '';
                usageJson = JSON.stringify(parsedResult.usage || {});

                // Debug: parsing results
                const parseDebug = [
                    '',
                    `Parsed response length: ${claudeResponse.length}`,
                    `Response preview: ${claudeResponse.substring(0, 200)}`,
                    `Tools used: ${toolsUsed}`,
                    `Tools count: ${toolsCount}`,
                    `Model: ${modelId}`,
                    `Usage JSON: ${usageJson}`,
                    `Session ID: ${hookSessionId}`
                ].join('\n');

                fs.appendFileSync(logFile, parseDebug + '\n', 'utf8');

            } catch (e) {
                // If transcript parsing fails, log error and continue
                fs.appendFileSync(logFile, `Transcript parsing error: ${e.message}\n`, 'utf8');
            }
        }

        // Calculate elapsed time (approximate)
        const startTime = sessionData.timestamp;
        const endTime = timestamp;
        const duration = Math.floor((new Date(endTime) - new Date(startTime)) / 1000);

        // Update CSV (response information) using csv-updater.js
        const csvUpdaterPath = path.join(scriptDir, 'csv-updater.js');
        const args = ['update-response', sessionId, claudeResponse, String(duration), toolsUsed, String(toolsCount), modelId, usageJson];

        spawn('node', [csvUpdaterPath, ...args], {
            stdio: ['ignore', 'inherit', 'inherit'],
            detached: false
        });

        // Save current response session information to SESSION_FILE (for next satisfaction rating)
        const newSessionInfo = {
            session_id: sessionId,
            timestamp: endTime,
            project_path: process.cwd()
        };

        fs.writeFileSync(sessionFile, JSON.stringify(newSessionInfo, null, 2), 'utf8');

        // Feedback guidance message (return as JSON)
        const feedbackMessage = {
            decision: "proceed",
            message: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Rate satisfaction: Enter 1-5 in next prompt\n[1] ⭐ Very Poor [2] ⭐⭐ Poor [3] ⭐⭐⭐ Average\n[4] ⭐⭐⭐⭐ Good [5] ⭐⭐⭐⭐⭐ Excellent\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        };

        console.log(JSON.stringify(feedbackMessage));
        process.exit(0);

    } catch (error) {
        console.error('Error in stop hook:', error.message);
        process.exit(1);
    }
}