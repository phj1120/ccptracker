#!/usr/bin/env node
/**
 * Transcript Parser - Extract last assistant response from Claude Code transcript
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const transcriptPath = process.argv[2] || '';
const sessionId = process.argv[3] || '';

if (!transcriptPath) {
    console.log(JSON.stringify({
        response: '',
        tools_used: '',
        tools_count: 0,
        model: '',
        usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_tokens: 0,
            cache_read_tokens: 0
        }
    }));
    process.exit(0);
}

/**
 * Extract actual token usage from transcript
 * Reads the most recent assistant message's usage field
 */
function extractUsageFromTranscript(lines) {
    // Process lines in reverse to find the most recent assistant message with usage
    const reversedLines = lines.slice().reverse();

    for (const line of reversedLines) {
        try {
            const data = JSON.parse(line);
            const message = data.message || {};
            const usage = message.usage || {};

            // Check if this is an assistant message with usage data
            if (message.role === 'assistant' && Object.keys(usage).length > 0) {
                // Calculate total input tokens including cache
                const inputTokens = usage.input_tokens || 0;
                const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
                const cacheReadTokens = usage.cache_read_input_tokens || 0;
                const outputTokens = usage.output_tokens || 0;

                const totalInputTokens = inputTokens + cacheCreationTokens + cacheReadTokens;

                return {
                    input_tokens: totalInputTokens,
                    output_tokens: outputTokens,
                    cache_creation_tokens: cacheCreationTokens,
                    cache_read_tokens: cacheReadTokens
                };
            }
        } catch (parseError) {
            // Skip invalid JSON lines
            continue;
        }
    }

    // No usage found
    return {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_tokens: 0,
        cache_read_tokens: 0
    };
}

try {
    if (!fs.existsSync(transcriptPath)) {
        console.log(JSON.stringify({
            response: '',
            tools_used: '',
            tools_count: 0,
            model: '',
            usage: {
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_tokens: 0,
                cache_read_tokens: 0
            }
        }));
        process.exit(0);
    }

    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    // Find last assistant response
    let lastResponse = "";
    const toolsUsed = new Set();
    let responseTexts = [];
    let lastAssistantTimestamp = 0;
    let modelId = '';

    // Process lines in reverse order to find the most recent assistant message
    const reversedLines = lines.slice().reverse();

    for (const line of reversedLines) {
        try {
            const data = JSON.parse(line);
            // message object contains role and content
            const message = data.message || {};
            const timestamp = data.timestamp || 0;

            // Extract model information if available
            if (!modelId && data.model) {
                modelId = data.model;
            }

            if (message.role === 'assistant' && responseTexts.length === 0) {
                // Extract model from message if not found yet
                if (!modelId && message.model) {
                    modelId = message.model;
                }

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

    // Extract actual usage from transcript
    const usage = extractUsageFromTranscript(lines);

    // Output result
    const result = {
        response: lastResponse,
        tools_used: Array.from(toolsUsed).sort().join(','),
        tools_count: toolsUsed.size,
        model: modelId || 'claude-sonnet-4-5',
        usage: usage
    };

    console.log(JSON.stringify(result));

} catch (error) {
    // Return empty result on error
    console.log(JSON.stringify({
        response: '',
        tools_used: '',
        tools_count: 0,
        model: '',
        usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_tokens: 0,
            cache_read_tokens: 0
        }
    }));
}