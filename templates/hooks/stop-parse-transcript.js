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
    let lastAssistantTimestamp = 0;

    // Process lines in reverse order to find the most recent assistant message
    const reversedLines = lines.slice().reverse();

    for (const line of reversedLines) {
        try {
            const data = JSON.parse(line);
            // message object contains role and content
            const message = data.message || {};
            const timestamp = data.timestamp || 0;

            if (message.role === 'assistant' && responseTexts.length === 0) {
                // Take the first (most recent) assistant message found
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

                // Store all text from this assistant message
                if (currentTexts.length > 0) {
                    responseTexts = currentTexts;
                    lastAssistantTimestamp = timestamp;
                    break; // Found the most recent, stop searching
                }
            }
        } catch (parseError) {
            // Skip invalid JSON lines
            continue;
        }
    }

    // If no response found in reverse search, fall back to forward search
    if (responseTexts.length === 0) {
        for (const line of lines) {
            try {
                const data = JSON.parse(line);
                const message = data.message || {};
                const timestamp = data.timestamp || 0;

                if (message.role === 'assistant') {
                    // Only process if this is a newer assistant message
                    if (timestamp >= lastAssistantTimestamp) {
                        lastAssistantTimestamp = timestamp;

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
                            responseTexts = currentTexts; // Replace with latest response
                        }
                    }
                }
            } catch (parseError) {
                // Skip invalid JSON lines
                continue;
            }
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