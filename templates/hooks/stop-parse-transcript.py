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

    # 마지막 assistant 응답 찾기
    last_response = ""
    tools_used = set()
    response_texts = []

    for line in lines:
        try:
            data = json.loads(line)
            # message 객체 안에 role과 content가 있음
            message = data.get('message', {})
            if message.get('role') == 'assistant':
                # 텍스트 응답 수집
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
                # 현재 assistant 메시지의 모든 텍스트를 결합하여 저장
                if current_texts:
                    response_texts = current_texts  # 마지막 응답으로 계속 업데이트
        except:
            continue

    # 마지막 응답의 모든 텍스트를 결합
    last_response = ' '.join(response_texts)

    # 응답이 너무 길면 잘라내기 (CSV 저장용)
    if len(last_response) > 10000:
        last_response = last_response[:10000] + "...(생략)"

    # 결과 출력
    print(json.dumps({
        'response': last_response,
        'tools_used': ','.join(sorted(tools_used)),
        'tools_count': len(tools_used)
    }, ensure_ascii=False))

except Exception as e:
    print(json.dumps({'response': '', 'tools_used': '', 'tools_count': 0}))
