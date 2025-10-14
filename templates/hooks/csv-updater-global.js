#!/usr/bin/env node
/**
 * Global CSV Updater - Claude conversation data CSV update tool (Global version)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Global configuration
const GLOBAL_DIR = path.join(os.homedir(), '.ccptracker');
const CONFIG_PATH = path.join(GLOBAL_DIR, 'config.json');

// Read configuration to determine CSV location
function getCSVPath(projectPath) {
  let config = { dataLocation: 'global', csvPath: path.join(GLOBAL_DIR, 'data', 'ccptracker.csv') };

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
      // Use default config
    }
  }

  if (config.dataLocation === 'project' && projectPath) {
    return path.join(projectPath, 'ccptracker', 'data', 'ccptracker.csv');
  }

  return config.csvPath;
}

const FIELDNAMES = ['id', 'project_name', 'project_path', 'request', 'response', 'star', 'star_desc', 'request_dtm', 'response_dtm', 'star_dtm', 'duration', 'tools_used', 'tools_count', 'model', 'request_tokens_est', 'response_tokens_est', 'total_tokens_est', 'actual_input_tokens', 'actual_output_tokens', 'cache_creation_tokens', 'cache_read_tokens', 'estimated_cost', 'cost_currency'];

// Anthropic pricing (as of 2025, USD per token)
const PRICING = {
    'claude-sonnet-4-5': {
        input: 3.00 / 1_000_000,
        output: 15.00 / 1_000_000,
        cache_creation: 3.75 / 1_000_000,  // 25% more than input
        cache_read: 0.30 / 1_000_000       // 90% less than input
    },
    'claude-sonnet-3-5': {
        input: 3.00 / 1_000_000,
        output: 15.00 / 1_000_000,
        cache_creation: 3.75 / 1_000_000,
        cache_read: 0.30 / 1_000_000
    },
    'claude-opus-3': {
        input: 15.00 / 1_000_000,
        output: 75.00 / 1_000_000,
        cache_creation: 18.75 / 1_000_000,
        cache_read: 1.50 / 1_000_000
    },
    'default': {
        input: 3.00 / 1_000_000,
        output: 15.00 / 1_000_000,
        cache_creation: 3.75 / 1_000_000,
        cache_read: 0.30 / 1_000_000
    }
};

/**
 * Estimate token count from text
 * Approximation: ~3-4 characters per token (mixed English/Korean)
 */
function estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.length / 3.5);
}

/**
 * Calculate cost based on token counts and model
 * Supports both estimated (simple) and actual (with cache) calculations
 */
function calculateCost(inputTokens, outputTokens, model, cacheCreationTokens = 0, cacheReadTokens = 0) {
    const pricing = PRICING[model] || PRICING['default'];

    // If cache tokens are provided, calculate with detailed pricing
    if (cacheCreationTokens > 0 || cacheReadTokens > 0) {
        const regularInputCost = inputTokens * pricing.input;
        const cacheCreationCost = cacheCreationTokens * pricing.cache_creation;
        const cacheReadCost = cacheReadTokens * pricing.cache_read;
        const outputCost = outputTokens * pricing.output;
        return (regularInputCost + cacheCreationCost + cacheReadCost + outputCost).toFixed(6);
    }

    // Simple calculation for estimated tokens
    const inputCost = inputTokens * pricing.input;
    const outputCost = outputTokens * pricing.output;
    return (inputCost + outputCost).toFixed(6);
}

/**
 * Extract model name from model identifier
 * e.g., "claude-sonnet-4-5-20250929" -> "claude-sonnet-4-5"
 */
function normalizeModelName(modelId) {
    if (!modelId) return 'claude-sonnet-4-5';

    if (modelId.includes('sonnet-4')) return 'claude-sonnet-4-5';
    if (modelId.includes('sonnet-3.5') || modelId.includes('sonnet-3-5')) return 'claude-sonnet-3-5';
    if (modelId.includes('opus')) return 'claude-opus-3';

    return 'claude-sonnet-4-5'; // default
}

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
function readCSV(projectPath) {
    const CSV_FILE = getCSVPath(projectPath);
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
function saveCSV(rows, projectPath) {
    if (!rows || rows.length === 0) return;

    const CSV_FILE = getCSVPath(projectPath);

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
 * Add new row with project information
 */
function addRow(sessionId, timestamp, projectPath, userPrompt) {
    const rows = readCSV(projectPath);

    // Use local time for both ID and request_dtm
    const localTime = getLocalDatetime();
    const rowId = formatDatetimeId(localTime);

    // Estimate request tokens
    const requestTokens = estimateTokens(userPrompt);

    // Extract project name from path
    const projectName = path.basename(projectPath);

    const newRow = {
        id: rowId,
        project_name: projectName,
        project_path: projectPath,
        request: userPrompt,
        response: '',
        star: '',
        star_desc: '',
        request_dtm: localTime,
        response_dtm: '',
        star_dtm: '',
        duration: '',
        tools_used: '',
        tools_count: '',
        model: '',
        request_tokens_est: String(requestTokens),
        response_tokens_est: '',
        total_tokens_est: '',
        actual_input_tokens: '',
        actual_output_tokens: '',
        cache_creation_tokens: '',
        cache_read_tokens: '',
        estimated_cost: '',
        cost_currency: ''
    };

    rows.push(newRow);
    saveCSV(rows, projectPath);
    console.log(`✅ New row added to CSV (ID: ${rowId}, Project: ${projectName}, Session: ${sessionId})`);
}

/**
 * Update response information (most recent row)
 * Now accepts usage object with detailed token breakdown
 */
function updateResponse(sessionId, projectPath, response, duration, toolsUsed, toolsCount, modelId, usageData) {
    const rows = readCSV(projectPath);

    // Update most recent row
    if (rows.length > 0) {
        const row = rows[rows.length - 1];

        // Estimate response tokens (for comparison)
        const responseTokensEst = estimateTokens(response);
        const requestTokensEst = parseInt(row.request_tokens_est || '0');
        const totalTokensEst = requestTokensEst + responseTokensEst;

        // Parse usage data if provided
        let actualInputTokens = 0;
        let actualOutputTokens = 0;
        let cacheCreationTokens = 0;
        let cacheReadTokens = 0;

        if (usageData && typeof usageData === 'object') {
            actualInputTokens = usageData.input_tokens || 0;
            actualOutputTokens = usageData.output_tokens || 0;
            cacheCreationTokens = usageData.cache_creation_input_tokens || usageData.cache_creation_tokens || 0;
            cacheReadTokens = usageData.cache_read_input_tokens || usageData.cache_read_tokens || 0;
        }

        // Normalize model name
        const normalizedModel = normalizeModelName(modelId);

        // Calculate cost with actual usage if available
        let cost;
        if (actualInputTokens > 0 || actualOutputTokens > 0) {
            // Use actual tokens with cache breakdown
            const regularInputTokens = actualInputTokens - cacheCreationTokens - cacheReadTokens;
            cost = calculateCost(regularInputTokens, actualOutputTokens, normalizedModel, cacheCreationTokens, cacheReadTokens);
        } else {
            // Fall back to estimated tokens
            cost = calculateCost(requestTokensEst, responseTokensEst, normalizedModel);
        }

        row.response = response;
        row.response_dtm = getLocalDatetime();
        row.duration = duration;
        row.tools_used = toolsUsed;
        row.tools_count = toolsCount;
        row.response_tokens_est = String(responseTokensEst);
        row.total_tokens_est = String(totalTokensEst);
        row.model = normalizedModel;
        row.estimated_cost = cost;
        row.cost_currency = 'USD';
        row.actual_input_tokens = actualInputTokens > 0 ? String(actualInputTokens) : '';
        row.actual_output_tokens = actualOutputTokens > 0 ? String(actualOutputTokens) : '';
        row.cache_creation_tokens = cacheCreationTokens > 0 ? String(cacheCreationTokens) : '';
        row.cache_read_tokens = cacheReadTokens > 0 ? String(cacheReadTokens) : '';
    }

    saveCSV(rows, projectPath);
    console.log(`✅ Response information updated (Session: ${sessionId})`);
}

/**
 * Update satisfaction information (most recent row)
 */
function updateSatisfaction(sessionId, projectPath, score, comment) {
    const rows = readCSV(projectPath);

    // Update most recent row
    if (rows.length > 0) {
        rows[rows.length - 1].star = String(score);
        rows[rows.length - 1].star_desc = comment;
        rows[rows.length - 1].star_dtm = getLocalDatetime();
    }

    saveCSV(rows, projectPath);
    console.log(`✅ Satisfaction information updated (Session: ${sessionId}, Score: ${score}/5)`);
}

/**
 * Get latest row
 */
function getLatestRow(projectPath) {
    const rows = readCSV(projectPath);
    if (rows.length > 0) {
        return rows[rows.length - 1];
    }
    return null;
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log("Usage: csv-updater-global.js [add|update-response|update-satisfaction|get-latest]");
        process.exit(1);
    }

    const command = args[0];

    try {
        if (command === 'add') {
            // add <session_id> <timestamp> <project_path> <user_prompt>
            if (args.length < 5) {
                console.log("Usage: csv-updater-global.js add <session_id> <timestamp> <project_path> <user_prompt>");
                process.exit(1);
            }
            addRow(args[1], args[2], args[3], args[4]);

        } else if (command === 'update-response') {
            // update-response <session_id> <project_path> <response> <duration> <tools_used> <tools_count> <model_id> <usage_json>
            if (args.length < 9) {
                console.log("Usage: csv-updater-global.js update-response <session_id> <project_path> <response> <duration> <tools_used> <tools_count> <model_id> <usage_json>");
                process.exit(1);
            }
            // Parse usage JSON if provided
            let usageData = null;
            try {
                usageData = JSON.parse(args[8]);
            } catch (e) {
                // If parsing fails, use empty object
                usageData = {};
            }
            updateResponse(args[1], args[2], args[3], args[4], args[5], args[6], args[7], usageData);

        } else if (command === 'update-satisfaction') {
            // update-satisfaction <session_id> <project_path> <score> <comment>
            if (args.length < 5) {
                console.log("Usage: csv-updater-global.js update-satisfaction <session_id> <project_path> <score> <comment>");
                process.exit(1);
            }
            updateSatisfaction(args[1], args[2], args[3], args[4]);

        } else if (command === 'get-latest') {
            // get-latest <project_path>
            if (args.length < 2) {
                console.log("Usage: csv-updater-global.js get-latest <project_path>");
                process.exit(1);
            }
            const row = getLatestRow(args[1]);
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
    getLatestRow,
    getCSVPath
};
