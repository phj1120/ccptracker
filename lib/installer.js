const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class Installer {
  constructor() {
    this.templatesDir = path.join(__dirname, '../templates');
  }

  async install(projectPath, options = {}) {
    try {
      const claudeDir = path.join(projectPath, '.claude');
      const settingsPath = path.join(claudeDir, 'settings.json');
      const ccptrackerDir = path.join(projectPath, 'ccptracker');

      // .claude 디렉토리 확인
      if (!await fs.pathExists(claudeDir)) {
        return {
          success: false,
          error: '.claude directory not found. This doesn\'t appear to be a Claude Code project.'
        };
      }

      // 이미 설치되어 있는지 확인
      if (!options.force && await this.isInstalled(projectPath)) {
        return {
          success: false,
          error: 'ccptracker is already installed. Use --force to reinstall.'
        };
      }

      // cctracker 디렉토리 구조 생성
      await this.createCcptrackerStructure(ccptrackerDir);

      // 훅 파일들 복사
      await this.copyHookFiles(ccptrackerDir);

      // .claude/settings.json 업데이트
      await this.updateClaudeSettings(settingsPath);

      // .gitignore 업데이트
      await this.updateGitignore(projectPath, options.githide);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async remove(projectPath) {
    try {
      const claudeDir = path.join(projectPath, '.claude');
      const settingsPath = path.join(claudeDir, 'settings.json');
      const ccptrackerDir = path.join(projectPath, 'ccptracker');

      // .claude/settings.json에서 훅 제거
      await this.removeClaudeSettings(settingsPath);

      // cctracker 디렉토리 제거
      if (await fs.pathExists(ccptrackerDir)) {
        await fs.remove(ccptrackerDir);
      }

      // .gitignore에서 제거
      await this.removeFromGitignore(projectPath);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async isInstalled(projectPath) {
    const ccptrackerDir = path.join(projectPath, 'ccptracker');
    const hookPath = path.join(ccptrackerDir, 'hooks', 'user-prompt-submit');
    return await fs.pathExists(hookPath);
  }

  async createCcptrackerStructure(ccptrackerDir) {
    // cctracker 디렉토리 구조 생성
    await fs.ensureDir(path.join(ccptrackerDir, 'hooks'));
    await fs.ensureDir(path.join(ccptrackerDir, 'data'));
    await fs.ensureDir(path.join(ccptrackerDir, 'logs'));
    await fs.ensureDir(path.join(ccptrackerDir, 'temp'));

    // 빈 CSV 파일 생성 (헤더 포함)
    const csvPath = path.join(ccptrackerDir, 'data', 'ccptracker.csv');
    if (!await fs.pathExists(csvPath)) {
      const csvHeader = 'id,request,response,star,star_desc,request_dtm,response_dtm,star_dtm\n';
      await fs.writeFile(csvPath, csvHeader, 'utf8');
    }
  }

  async copyHookFiles(ccptrackerDir) {
    const hookFiles = [
      'user-prompt-submit',
      'stop',
      'csv-updater.py',
      'stop-parse-transcript.py'
    ];

    const hooksDir = path.join(ccptrackerDir, 'hooks');

    for (const file of hookFiles) {
      const sourcePath = path.join(this.templatesDir, 'hooks', file);
      const targetPath = path.join(hooksDir, file);

      await fs.copy(sourcePath, targetPath);

      // 스크립트 파일에 실행 권한 부여
      if (!file.endsWith('.py')) {
        await fs.chmod(targetPath, '755');
      }
    }
  }

  async updateClaudeSettings(settingsPath) {
    let settings = {};

    // 기존 settings.json 읽기
    if (await fs.pathExists(settingsPath)) {
      const content = await fs.readFile(settingsPath, 'utf8');
      try {
        settings = JSON.parse(content);
      } catch (error) {
        console.log(chalk.yellow('⚠️  Existing settings.json is invalid, creating new one'));
      }
    }

    // hooks 섹션이 없으면 생성
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // ccptracker 훅 추가
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit || [];
    settings.hooks.Stop = settings.hooks.Stop || [];

    // 기존 ccptracker 훅 제거 (중복 방지)
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
      hook => !hook.hooks?.some(h => h.command?.includes('ccptracker/hooks'))
    );
    settings.hooks.Stop = settings.hooks.Stop.filter(
      hook => !hook.hooks?.some(h => h.command?.includes('ccptracker/hooks'))
    );

    // 새 훅 추가
    settings.hooks.UserPromptSubmit.push({
      matcher: "",
      hooks: [{
        type: "command",
        command: "./ccptracker/hooks/user-prompt-submit"
      }]
    });

    settings.hooks.Stop.push({
      matcher: "",
      hooks: [{
        type: "command",
        command: "./ccptracker/hooks/stop"
      }]
    });

    // settings.json 저장
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }

  async removeClaudeSettings(settingsPath) {
    if (!await fs.pathExists(settingsPath)) {
      return;
    }

    const content = await fs.readFile(settingsPath, 'utf8');
    let settings;

    try {
      settings = JSON.parse(content);
    } catch (error) {
      return; // JSON 파싱 실패하면 그냥 리턴
    }

    if (!settings.hooks) {
      return;
    }

    // ccptracker 훅 제거
    if (settings.hooks.UserPromptSubmit) {
      settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
        hook => !hook.hooks?.some(h => h.command?.includes('ccptracker/hooks'))
      );
    }

    if (settings.hooks.Stop) {
      settings.hooks.Stop = settings.hooks.Stop.filter(
        hook => !hook.hooks?.some(h => h.command?.includes('ccptracker/hooks'))
      );
    }

    // 빈 배열이면 제거
    if (settings.hooks.UserPromptSubmit?.length === 0) {
      delete settings.hooks.UserPromptSubmit;
    }
    if (settings.hooks.Stop?.length === 0) {
      delete settings.hooks.Stop;
    }

    // hooks가 빈 객체면 제거
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }

  async updateGitignore(projectPath, hideCSV = false) {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const ccptrackerFolderEntry = 'ccptracker/';
    const ccptrackerCsvEntry = '!ccptracker/data/ccptracker.csv';

    try {
      let content = '';

      // .gitignore 파일이 존재하면 읽기
      if (await fs.pathExists(gitignorePath)) {
        content = await fs.readFile(gitignorePath, 'utf8');
      }

      // 이미 ccptracker/ 항목이 있는지 확인
      if (content.includes(ccptrackerFolderEntry)) {
        return; // 이미 있으면 추가하지 않음
      }

      // ccptracker/ 항목 추가
      if (content && !content.endsWith('\n')) {
        content += '\n';
      }

      content += `\n# ccptracker conversation tracking data\n${ccptrackerFolderEntry}\n`;

      // hideCSV가 false인 경우에만 CSV 예외 추가 (기본값은 CSV 파일 추적)
      if (!hideCSV) {
        content += `${ccptrackerCsvEntry}\n`;
      }

      await fs.writeFile(gitignorePath, content, 'utf8');
    } catch (error) {
      // .gitignore 업데이트 실패는 치명적이지 않으므로 로그만 출력
      console.log(chalk.yellow('⚠️  Warning: Could not update .gitignore:', error.message));
    }
  }

  async removeFromGitignore(projectPath) {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const ccptrackerFolderEntry = 'ccptracker/';
    const ccptrackerCsvEntry = '!ccptracker/data/ccptracker.csv';

    try {
      if (!await fs.pathExists(gitignorePath)) {
        return; // .gitignore 파일이 없으면 아무것도 하지 않음
      }

      let content = await fs.readFile(gitignorePath, 'utf8');
      const lines = content.split('\n');

      // ccptracker 관련 라인들 제거
      const filteredLines = lines.filter(line => {
        const trimmedLine = line.trim();
        return !trimmedLine.includes(ccptrackerFolderEntry) &&
               !trimmedLine.includes(ccptrackerCsvEntry) &&
               !trimmedLine.includes('# ccptracker conversation tracking data');
      });

      // 파일 다시 쓰기
      await fs.writeFile(gitignorePath, filteredLines.join('\n'), 'utf8');
    } catch (error) {
      // .gitignore 업데이트 실패는 치명적이지 않으므로 로그만 출력
      console.log(chalk.yellow('⚠️  Warning: Could not update .gitignore:', error.message));
    }
  }
}

module.exports = new Installer();