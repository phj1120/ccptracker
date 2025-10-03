# ccptracker 🤖📊

**Claude Code conversation tracker and satisfaction logger**

ccptracker를 사용하면 Claude Code와의 모든 대화를 자동으로 기록하고, 만족도를 평가할 수 있습니다. 대화 데이터를 CSV 형태로 저장하여 나중에 분석하고 활용할 수 있습니다.

## ✨ 주요 기능

- 🔄 **자동 대화 기록**: Claude Code와의 모든 대화가 자동으로 CSV에 저장됩니다
- ⭐ **만족도 평가**: 각 응답에 대해 1-5점 평가가 가능합니다
- 📊 **통계 대시보드**: 총 대화 수, 평균 평점 등을 확인할 수 있습니다
- 📁 **데이터 내보내기**: CSV 또는 JSON 형태로 데이터를 내보낼 수 있습니다
- 🚀 **원클릭 설치**: `npx ccptracker init`로 간단하게 설치
- 🔧 **자동 설정**: `.claude/settings.json` 훅이 자동으로 등록됩니다

## 🚀 빠른 시작

### 1. 설치

Claude Code 프로젝트 디렉토리에서 다음 명령어를 실행하세요:

```bash
npx ccptracker init
```

### 2. 사용

이제 Claude Code를 평소처럼 사용하면 모든 대화가 자동으로 기록됩니다!

각 Claude 응답 후에 1-5 숫자를 입력하여 만족도를 평가할 수 있습니다:

```
1 ⭐ 매우 별로
2 ⭐⭐ 별로
3 ⭐⭐⭐ 중간
4 ⭐⭐⭐⭐ 좋음
5 ⭐⭐⭐⭐⭐ 매우 좋음
```

### 3. 상태 확인

```bash
npx ccptracker status
```

출력 예시:
```
📊 ccptracker Status
✅ Installed and configured
📝 Total conversations: 25
⭐ Average satisfaction: 4.2/5 ⭐⭐⭐⭐
🕒 Last conversation: 2025-01-03 13:45:32
📁 Data location: ./cpm/data/claude-conversations.csv
```

## 📖 사용법

### 설치 명령어

```bash
# 새 프로젝트에 ccptracker 설치
npx ccptracker init

# 기존 설치를 덮어쓰기
npx ccptracker init --force
```

### 상태 확인

```bash
# 현재 상태 및 통계 확인
npx ccptracker status
```

### 데이터 내보내기

```bash
# CSV 형태로 내보내기 (기본값)
npx ccptracker export

# JSON 형태로 내보내기
npx ccptracker export --format json

# 특정 파일로 내보내기
npx ccptracker export --output my-conversations.csv
```

### 제거

```bash
# ccptracker 완전 제거 (확인 메시지 포함)
npx ccptracker remove

# 강제 제거 (확인 없이)
npx ccptracker remove --force
```

## 📁 파일 구조

ccptracker를 설치하면 다음과 같은 구조가 생성됩니다:

```
your-project/
├── .claude/
│   └── settings.json        # Claude Code 훅 설정 (자동 등록)
└── cpm/
    ├── hooks/               # 훅 스크립트들
    │   ├── user-prompt-submit
    │   ├── stop
    │   ├── csv-updater.py
    │   └── stop-parse-transcript.py
    ├── data/
    │   └── claude-conversations.csv  # 대화 데이터
    ├── logs/                # 디버그 로그
    └── temp/                # 임시 파일
```

## 📊 데이터 형식

### CSV 필드

| 필드 | 설명 | 예시 |
|------|------|------|
| `id` | 대화 ID (YYYYMMDDHHmmss) | `20250103134532` |
| `request` | 사용자 프롬프트 | `"React 컴포넌트를 만들어줘"` |
| `response` | Claude 응답 | `"React 컴포넌트를 만들어드릴게요..."` |
| `star` | 만족도 평점 (1-5) | `4` |
| `star_desc` | 평점 코멘트 | `""` |
| `request_dtm` | 요청 시간 | `2025-01-03 13:45:32` |
| `response_dtm` | 응답 시간 | `2025-01-03 13:45:45` |
| `star_dtm` | 평가 시간 | `2025-01-03 13:46:00` |

### JSON 형식 (export)

```json
{
  "exportedAt": "2025-01-03T13:50:00.000Z",
  "totalConversations": 25,
  "conversations": [
    {
      "id": "20250103134532",
      "request": "React 컴포넌트를 만들어줘",
      "response": "React 컴포넌트를 만들어드릴게요...",
      "rating": 4,
      "ratingComment": null,
      "requestTime": "2025-01-03 13:45:32",
      "responseTime": "2025-01-03 13:45:45",
      "ratingTime": "2025-01-03 13:46:00"
    }
  ]
}
```

## 🔧 고급 설정

### 수동 훅 등록

ccptracker가 자동으로 `.claude/settings.json`을 수정하지만, 수동으로 관리하고 싶다면:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "./cpm/hooks/user-prompt-submit"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "./cpm/hooks/stop"
          }
        ]
      }
    ]
  }
}
```

### 로그 확인

문제가 생겼을 때 디버그 로그를 확인할 수 있습니다:

```bash
# 사용자 프롬프트 훅 로그
cat cpm/logs/user-prompt-submit-debug.log

# 응답 처리 훅 로그
cat cpm/logs/stop-hook-debug.log
```

## 🤝 프로그래밍 인터페이스

ccptracker를 Node.js 프로젝트에서 직접 사용할 수도 있습니다:

```javascript
const ccptracker = require('ccptracker');

// 설치
const result = await ccptracker.install('/path/to/project');

// 상태 확인
const status = await ccptracker.status('/path/to/project');

// 데이터 내보내기
const exported = await ccptracker.export('/path/to/project', {
  format: 'json',
  output: 'conversations.json'
});

// 제거
await ccptracker.remove('/path/to/project');
```

## ❓ FAQ

### Q: Claude Code가 아닌 프로젝트에서도 사용할 수 있나요?
A: 아니요. ccptracker는 Claude Code의 훅 시스템을 사용하므로 Claude Code 프로젝트에서만 작동합니다.

### Q: 기존 대화 데이터는 어떻게 되나요?
A: ccptracker는 기존 데이터를 보존합니다. 제거할 때만 `cpm/` 디렉토리가 삭제됩니다.

### Q: 만족도 평가를 건너뛸 수 있나요?
A: 네, 1-5 숫자 대신 다른 프롬프트를 입력하면 평가 없이 다음 대화로 넘어갑니다.

### Q: 여러 프로젝트에서 ccptracker를 사용할 수 있나요?
A: 네, 각 프로젝트마다 독립적으로 설치하고 사용할 수 있습니다.

### Q: Windows에서도 작동하나요?
A: 네, Node.js와 Python이 설치되어 있다면 Windows, macOS, Linux 모두에서 작동합니다.

## 🐛 문제 해결

### 설치가 안 될 때
1. Claude Code 프로젝트 디렉토리인지 확인하세요 (`.claude/` 폴더 존재)
2. Node.js 14+ 버전이 설치되어 있는지 확인하세요
3. Python 3.x가 설치되어 있는지 확인하세요

### 대화가 기록되지 않을 때
1. `npx ccptracker status`로 설치 상태를 확인하세요
2. `.claude/settings.json`에 훅이 제대로 등록되어 있는지 확인하세요
3. `cpm/logs/` 디렉토리의 로그 파일을 확인하세요

### 만족도 평가가 작동하지 않을 때
1. 숫자 1-5만 입력했는지 확인하세요
2. 이전 대화가 있는지 확인하세요 (첫 번째 대화는 평가할 수 없음)

## 📄 라이선스

MIT License

## 🤝 기여하기

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 지원

- 이슈: [GitHub Issues](https://github.com/claude-code/ccptracker/issues)
- 문서: [README.md](https://github.com/claude-code/ccptracker/blob/main/README.md)

---

**즐거운 Claude Code 경험을 위해 ccptracker와 함께하세요! 🤖✨**