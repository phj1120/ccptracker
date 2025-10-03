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
      const cpmDir = path.join(projectPath, 'cpm');

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
          error: 'cctracker is already installed. Use --force to reinstall.'
        };
      }

      // cpm 디렉토리 구조 생성
      await this.createCpmStructure(cpmDir);

      // 훅 파일들 복사
      await this.copyHookFiles(cpmDir);

      // .claude/settings.json 업데이트
      await this.updateClaudeSettings(settingsPath);

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
      const cpmDir = path.join(projectPath, 'cpm');

      // .claude/settings.json에서 훅 제거
      await this.removeClaudeSettings(settingsPath);

      // cpm 디렉토리 제거
      if (await fs.pathExists(cpmDir)) {
        await fs.remove(cpmDir);
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async isInstalled(projectPath) {
    const cpmDir = path.join(projectPath, 'cpm');
    const hookPath = path.join(cpmDir, 'hooks', 'user-prompt-submit');
    return await fs.pathExists(hookPath);
  }

  async createCpmStructure(cpmDir) {
    // cpm 디렉토리 구조 생성
    await fs.ensureDir(path.join(cpmDir, 'hooks'));
    await fs.ensureDir(path.join(cpmDir, 'data'));
    await fs.ensureDir(path.join(cpmDir, 'logs'));
    await fs.ensureDir(path.join(cpmDir, 'temp'));

    // 빈 CSV 파일 생성 (헤더 포함)
    const csvPath = path.join(cpmDir, 'data', 'claude-conversations.csv');
    if (!await fs.pathExists(csvPath)) {
      const csvHeader = 'id,request,response,star,star_desc,request_dtm,response_dtm,star_dtm\n';
      await fs.writeFile(csvPath, csvHeader, 'utf8');
    }
  }

  async copyHookFiles(cpmDir) {
    const hookFiles = [
      'user-prompt-submit',
      'stop',
      'csv-updater.py',
      'stop-parse-transcript.py'
    ];

    const hooksDir = path.join(cpmDir, 'hooks');

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

    // cctracker 훅 추가
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit || [];
    settings.hooks.Stop = settings.hooks.Stop || [];

    // 기존 cctracker 훅 제거 (중복 방지)
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
      hook => !hook.hooks?.some(h => h.command?.includes('cpm/hooks'))
    );
    settings.hooks.Stop = settings.hooks.Stop.filter(
      hook => !hook.hooks?.some(h => h.command?.includes('cpm/hooks'))
    );

    // 새 훅 추가
    settings.hooks.UserPromptSubmit.push({
      matcher: "",
      hooks: [{
        type: "command",
        command: "./cpm/hooks/user-prompt-submit"
      }]
    });

    settings.hooks.Stop.push({
      matcher: "",
      hooks: [{
        type: "command",
        command: "./cpm/hooks/stop"
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

    // cctracker 훅 제거
    if (settings.hooks.UserPromptSubmit) {
      settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
        hook => !hook.hooks?.some(h => h.command?.includes('cpm/hooks'))
      );
    }

    if (settings.hooks.Stop) {
      settings.hooks.Stop = settings.hooks.Stop.filter(
        hook => !hook.hooks?.some(h => h.command?.includes('cpm/hooks'))
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
}

module.exports = new Installer();