# CCPTracker Upgrade Summary - Cross-Platform Global Version

## 완료된 작업

### 1. 글로벌 설정 구조 (`lib/config.js`)
- ✅ `~/.ccptracker/` 홈 디렉토리 기반 글로벌 설정
- ✅ `config.json`으로 데이터 저장 위치 관리 (`global` | `project`)
- ✅ `project_path` 필드로 프로젝트별 필터링 지원
- ✅ CSV 경로를 설정에서 동적으로 가져오기

### 2. 크로스 플랫폼 Hooks (Node.js)
- ✅ `user-prompt-submit.js` - Windows/Mac/Linux 호환
- ✅ `stop.js` - Windows/Mac/Linux 호환
- ✅ bash 스크립트 의존성 제거 (내장 crypto 모듈 사용)

### 3. CSV 구조 업데이트 (`csv-updater.js`)
- ✅ `project_path` 필드 추가
- ✅ `project_name` 필드 추가
- ✅ 글로벌 설정에서 CSV 경로 읽기
- ✅ 세션별로 프로젝트 정보 저장

## 남은 작업

### 4. Installer 글로벌 설치 (`lib/installer.js`)
```javascript
// 필요한 변경사항:
- 글로벌 ~/.ccptracker/ 디렉토리에 훅 설치
- Claude settings.json을 사용자 글로벌 설정에 업데이트
- 프로젝트별 ccptracker/ 폴더 제거 (선택적)
```

### 5. CLI 명령어 업데이트 (`bin/cli.js`)
```bash
# 추가 필요 명령어:
ccptracker install --global    # 글로벌 설치
ccptracker config set dataLocation global|project
ccptracker config get
ccptracker migrate              # 프로젝트별 데이터를 글로벌로 마이그레이션
```

### 6. stop-parse-transcript.js 모듈화
- `module.exports` 추가하여 stop.js에서 require 가능하도록

## 새로운 구조

### 디렉토리 구조
```
~/.ccptracker/                  # 사용자 홈 디렉토리
├── config.json                 # 글로벌 설정
│   {
│     "dataLocation": "global",
│     "csvPath": "~/.ccptracker/data/ccptracker.csv"
│   }
├── hooks/                      # 공통 훅 (Node.js, 크로스 플랫폼)
│   ├── user-prompt-submit.js
│   ├── stop.js
│   ├── csv-updater.js
│   └── stop-parse-transcript.js
├── data/                       # 글로벌 CSV 저장
│   └── ccptracker.csv          # project_path로 프로젝트 구분
├── temp/                       # 세션 임시 파일
│   └── current-session.json
└── logs/                       # 디버그 로그
    ├── user-prompt-submit-debug.log
    └── stop-hook-debug.log
```

### CSV 구조 (업데이트됨)
```csv
id,project_path,project_name,request,response,star,star_desc,request_dtm,response_dtm,star_dtm,...
```

### Claude Code 설정 (~/.claude/settings.json)
```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node ~/.ccptracker/hooks/user-prompt-submit.js"
      }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node ~/.ccptracker/hooks/stop.js"
      }]
    }]
  }
}
```

## 사용 시나리오

### 1. 글로벌 모드 (기본, 권장)
```bash
ccptracker install --global
# 모든 프로젝트 대화가 ~/.ccptracker/data/ccptracker.csv에 저장
# project_path로 구분되어 프로젝트별 통계 조회 가능
```

### 2. 프로젝트별 모드
```bash
ccptracker config set dataLocation project
# 각 프로젝트의 ./ccptracker/data/ccptracker.csv에 저장
```

## 장점

1. **Windows 지원**: `.sh` 파일 대신 Node.js 스크립트 사용
2. **경로 독립적**: 어디서든 훅이 동작 (`~/.ccptracker/` 고정)
3. **중앙 관리**: 모든 프로젝트 대화를 한 곳에서 관리
4. **프로젝트 구분**: `project_path` 필드로 프로젝트별 필터링
5. **유연성**: 설정으로 글로벌/프로젝트 모드 전환 가능

## 다음 단계

1. `lib/installer.js` 글로벌 설치 로직 구현
2. `bin/cli.js` 글로벌 명령어 추가
3. `stop-parse-transcript.js` 모듈 export 추가
4. 테스트 및 버그 수정
5. README 업데이트
6. npm 버전 업데이트 (v2.0.0)
