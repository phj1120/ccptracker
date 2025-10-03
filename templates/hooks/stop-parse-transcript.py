import json
import sys
import os

transcript_path = sys.argv[1] if len(sys.argv) > 1 else ''

if not transcript_path:
    print(json.dumps({'response': '', 'tools_used': '', 'tools_count': 0}))
    sys.exit(0)

try:
    with open(transcript_path, 'r') as f:
        lines = f.readlines()

    # Find last assistant response
    last_response = ""
    tools_used = set()
    response_texts = []

    for line in lines:
        try:
            data = json.loads(line)
            # message object contains role and content
            message = data.get('message', {})
            if message.get('role') == 'assistant':
                # Collect text responses
                content = message.get('content', [])
                current_texts = []
                for item in content:
                    if isinstance(item, dict):
                        if item.get('type') == 'text':
                            text = item.get('text', '').strip()
                            if text:
                                current_texts.append(text)
                        elif item.get('type') == 'tool_use':
                            tools_used.add(item.get('name', ''))
                # Store all text from current assistant message combined
                if current_texts:
                    response_texts = current_texts  # Keep updating to last response
        except:
            continue

    # Combine all text from last response
    last_response = ' '.join(response_texts)

    # Truncate if response is too long (for CSV storage)
    if len(last_response) > 10000:
        last_response = last_response[:10000] + "...(truncated)"

    # Output result
    print(json.dumps({
        'response': last_response,
        'tools_used': ','.join(sorted(tools_used)),
        'tools_count': len(tools_used)
    }, ensure_ascii=False))

except Exception as e:
    print(json.dumps({'response': '', 'tools_used': '', 'tools_count': 0}))
