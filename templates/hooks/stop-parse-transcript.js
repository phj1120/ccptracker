#!/usr/bin/env node
/**
 * Transcript Parser - Extract last assistant response from Claude Code transcript
 */

const fs = require('fs');

const transcriptPath = process.argv[2] || '';

if (!transcriptPath) {
    console.log(JSON.stringify({ response: '', tools_used: '', tools_count: 0 }));
    process.exit(0);
}

try {
    if (!fs.existsSync(transcriptPath)) {
        console.log(JSON.stringify({ response: '', tools_used: '', tools_count: 0 }));
        process.exit(0);
    }

    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    // Find last assistant response
    let lastResponse = "";
    const toolsUsed = new Set();
    let responseTexts = [];

    for (const line of lines) {
        try {
            const data = JSON.parse(line);
            // message object contains role and content
            const message = data.message || {};

            if (message.role === 'assistant') {
                // Collect text responses
                const content = message.content || [];
                const currentTexts = [];

                for (const item of content) {
                    if (item && typeof item === 'object') {
                        if (item.type === 'text') {
                            const text = (item.text || '').trim();
                            if (text) {
                                currentTexts.push(text);
                            }
                        } else if (item.type === 'tool_use') {
                            const toolName = item.name || '';
                            if (toolName) {
                                toolsUsed.add(toolName);
                            }
                        }
                    }
                }

                // Store all text from current assistant message combined
                if (currentTexts.length > 0) {
                    responseTexts = currentTexts; // Keep updating to last response
                }
            }
        } catch (parseError) {
            // Skip invalid JSON lines
            continue;
        }
    }

    // Combine all text from last response
    lastResponse = responseTexts.join(' ');

    // Truncate if response is too long (for CSV storage)
    if (lastResponse.length > 10000) {
        lastResponse = lastResponse.substring(0, 10000) + "...(truncated)";
    }

    // Output result
    const result = {
        response: lastResponse,
        tools_used: Array.from(toolsUsed).sort().join(','),
        tools_count: toolsUsed.size
    };

    console.log(JSON.stringify(result));

} catch (error) {
    // Return empty result on error
    console.log(JSON.stringify({ response: '', tools_used: '', tools_count: 0 }));
}