#!/usr/bin/env node
/**
 * CSV Updater - Claude conversation data CSV update tool
 */

const fs = require('fs');
const path = require('path');

// Find ccptracker directory in project root
const SCRIPT_DIR = path.dirname(path.resolve(__filename));
const CCPTRACKER_DIR = path.dirname(SCRIPT_DIR);
const CSV_FILE = path.join(CCPTRACKER_DIR, 'data', 'ccptracker.csv');

const FIELDNAMES = ['id', 'request', 'response', 'star', 'star_desc', 'request_dtm', 'response_dtm', 'star_dtm'];

/**
 * Simple CSV parser
 */
function parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Simple CSV parsing - handles quoted fields
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        rows.push(row);
    }

    return rows;
}

/**
 * Simple CSV writer
 */
function writeCSV(rows) {
    if (!rows || rows.length === 0) return;

    const lines = [FIELDNAMES.join(',')];

    rows.forEach(row => {
        const values = FIELDNAMES.map(field => {
            let value = row[field] || '';
            // Escape quotes and wrap in quotes if contains comma or newline
            if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                value = '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        });
        lines.push(values.join(','));
    });

    return lines.join('\n') + '\n';
}

/**
 * Read CSV file
 */
function readCSV() {
    if (!fs.existsSync(CSV_FILE)) {
        return [];
    }

    try {
        const content = fs.readFileSync(CSV_FILE, 'utf8');
        return parseCSV(content);
    } catch (error) {
        console.error('Error reading CSV:', error.message);
        return [];
    }
}

/**
 * Write CSV file
 */
function saveCSV(rows) {
    if (!rows || rows.length === 0) return;

    try {
        const content = writeCSV(rows);
        fs.writeFileSync(CSV_FILE, content, 'utf8');
    } catch (error) {
        console.error('Error writing CSV:', error.message);
    }
}

/**
 * Format datetime for ID: YYYY-MM-DD HH:MM:SS -> YYYYMMDDHHmmss
 */
function formatDatetimeId(dtString) {
    try {
        const dt = new Date(dtString);
        if (isNaN(dt.getTime())) return '';

        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        const hours = String(dt.getHours()).padStart(2, '0');
        const minutes = String(dt.getMinutes()).padStart(2, '0');
        const seconds = String(dt.getSeconds()).padStart(2, '0');

        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    } catch {
        return '';
    }
}

/**
 * Add new row
 */
function addRow(sessionId, timestamp, projectPath, userPrompt) {
    const rows = readCSV();

    // ID is numeric format, request_dtm is readable format
    const rowId = formatDatetimeId(timestamp);
    const requestDtm = timestamp; // Use YYYY-MM-DD HH:MM:SS format as-is

    const newRow = {
        id: rowId,
        request: userPrompt,
        response: '',
        star: '',
        star_desc: '',
        request_dtm: requestDtm,
        response_dtm: '',
        star_dtm: ''
    };

    rows.push(newRow);
    saveCSV(rows);
    console.log(`✅ New row added to CSV (ID: ${rowId}, Session: ${sessionId})`);
}

/**
 * Update response information (most recent row)
 */
function updateResponse(sessionId, response, duration, toolsUsed, toolsCount) {
    const rows = readCSV();

    // Update most recent row
    if (rows.length > 0) {
        const responseDtm = new Date().toISOString().slice(0, 19).replace('T', ' ');
        rows[rows.length - 1].response = response;
        rows[rows.length - 1].response_dtm = responseDtm;
    }

    saveCSV(rows);
    console.log(`✅ Response information updated (Session: ${sessionId})`);
}

/**
 * Update satisfaction information (most recent row)
 */
function updateSatisfaction(sessionId, score, comment) {
    const rows = readCSV();

    // Update most recent row
    if (rows.length > 0) {
        const starDtm = new Date().toISOString().slice(0, 19).replace('T', ' ');
        rows[rows.length - 1].star = String(score);
        rows[rows.length - 1].star_desc = comment;
        rows[rows.length - 1].star_dtm = starDtm;
    }

    saveCSV(rows);
    console.log(`✅ Satisfaction information updated (Session: ${sessionId}, Score: ${score}/5)`);
}

/**
 * Get latest row
 */
function getLatestRow() {
    const rows = readCSV();
    if (rows.length > 0) {
        return rows[rows.length - 1];
    }
    return null;
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log("Usage: csv-updater.js [add|update-response|update-satisfaction|get-latest]");
        process.exit(1);
    }

    const command = args[0];

    try {
        if (command === 'add') {
            // add <session_id> <timestamp> <project_path> <user_prompt>
            if (args.length < 5) {
                console.log("Usage: csv-updater.js add <session_id> <timestamp> <project_path> <user_prompt>");
                process.exit(1);
            }
            addRow(args[1], args[2], args[3], args[4]);

        } else if (command === 'update-response') {
            // update-response <session_id> <response> <duration> <tools_used> <tools_count>
            if (args.length < 6) {
                console.log("Usage: csv-updater.js update-response <session_id> <response> <duration> <tools_used> <tools_count>");
                process.exit(1);
            }
            updateResponse(args[1], args[2], args[3], args[4], args[5]);

        } else if (command === 'update-satisfaction') {
            // update-satisfaction <session_id> <score> <comment>
            if (args.length < 4) {
                console.log("Usage: csv-updater.js update-satisfaction <session_id> <score> <comment>");
                process.exit(1);
            }
            updateSatisfaction(args[1], args[2], args[3]);

        } else if (command === 'get-latest') {
            const row = getLatestRow();
            if (row) {
                console.log(JSON.stringify(row, null, 0));
            } else {
                console.log("{}");
            }

        } else {
            console.log(`Unknown command: ${command}`);
            process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

module.exports = {
    readCSV,
    saveCSV,
    addRow,
    updateResponse,
    updateSatisfaction,
    getLatestRow
};