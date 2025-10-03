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
    if (!content.trim()) return [];

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    // First, extract headers
    const headerEnd = content.indexOf('\n');
    if (headerEnd === -1) return [];
    
    const headerLine = content.substring(0, headerEnd);
    const headers = headerLine.split(',').map(h => h.trim());
    
    // Start parsing from after the header line
    i = headerEnd + 1;

    while (i < content.length) {
        const char = content[i];

        if (char === '"') {
            if (inQuotes && i + 1 < content.length && content[i + 1] === '"') {
                // Escaped quote
                currentField += '"';
                i += 2;
                continue;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
        } else if (char === '\n' && !inQuotes) {
            // End of row
            if (currentField.trim() || currentRow.length > 0) {
                currentRow.push(currentField.trim());
                
                // Create row object
                if (currentRow.length > 0 && currentRow.some(field => field.trim())) {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = currentRow[index] || '';
                    });
                    rows.push(row);
                }
                
                currentRow = [];
                currentField = '';
            }
        } else {
            currentField += char;
        }

        i++;
    }

    // Handle last row if no trailing newline
    if (currentField.trim() || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && currentRow.some(field => field.trim())) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = currentRow[index] || '';
            });
            rows.push(row);
        }
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
    // Ensure directory exists
    const csvDir = path.dirname(CSV_FILE);
    if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir, { recursive: true });
    }

    if (!fs.existsSync(CSV_FILE)) {
        // Create CSV file with headers if it doesn't exist
        const content = FIELDNAMES.join(',') + '\n';
        fs.writeFileSync(CSV_FILE, content, 'utf8');
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
 * Get current local time in YYYY-MM-DD HH:MM:SS format
 */
function getLocalDatetime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

    // Use local time for both ID and request_dtm
    const localTime = getLocalDatetime();
    const rowId = formatDatetimeId(localTime);

    const newRow = {
        id: rowId,
        request: userPrompt,
        response: '',
        star: '',
        star_desc: '',
        request_dtm: localTime,
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
        rows[rows.length - 1].response = response;
        rows[rows.length - 1].response_dtm = getLocalDatetime();
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
        rows[rows.length - 1].star = String(score);
        rows[rows.length - 1].star_desc = comment;
        rows[rows.length - 1].star_dtm = getLocalDatetime();
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