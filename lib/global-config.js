const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class GlobalConfig {
  constructor() {
    // 사용자 홈 디렉토리 기반 글로벌 설정
    this.globalDir = path.join(os.homedir(), '.ccptracker');
    this.configPath = path.join(this.globalDir, 'config.json');
    this.defaultConfig = {
      dataLocation: 'global',  // 'global' | 'project'
      csvPath: path.join(this.globalDir, 'data', 'ccptracker.csv')
    };
  }

  /**
   * 글로벌 디렉토리 구조 초기화
   */
  async ensureGlobalStructure() {
    await fs.ensureDir(this.globalDir);
    await fs.ensureDir(path.join(this.globalDir, 'hooks'));
    await fs.ensureDir(path.join(this.globalDir, 'data'));
    await fs.ensureDir(path.join(this.globalDir, 'temp'));
    await fs.ensureDir(path.join(this.globalDir, 'logs'));

    // config.json 생성 (없으면)
    if (!await fs.pathExists(this.configPath)) {
      await fs.writeJson(this.configPath, this.defaultConfig, { spaces: 2 });
    }

    // CSV 파일 생성 (없으면)
    const csvPath = await this.getCsvPath();
    if (!await fs.pathExists(csvPath)) {
      const csvHeader = 'id,project_name,project_path,request,response,star,star_desc,request_dtm,response_dtm,star_dtm,duration,tools_used,tools_count,model,input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens\n';
      await fs.writeFile(csvPath, csvHeader, 'utf8');
    }
  }

  /**
   * 설정 읽기
   */
  async readConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        return await fs.readJson(this.configPath);
      }
      return this.defaultConfig;
    } catch (error) {
      return this.defaultConfig;
    }
  }

  /**
   * 설정 쓰기
   */
  async writeConfig(config) {
    await fs.ensureDir(this.globalDir);
    await fs.writeJson(this.configPath, config, { spaces: 2 });
  }

  /**
   * CSV 파일 경로 가져오기
   */
  async getCsvPath(projectPath = null) {
    const config = await this.readConfig();

    if (config.dataLocation === 'project' && projectPath) {
      // 프로젝트별 저장
      const ccptrackerDir = path.join(projectPath, 'ccptracker');
      return path.join(ccptrackerDir, 'data', 'ccptracker.csv');
    }

    // 글로벌 저장
    return config.csvPath;
  }

  /**
   * 데이터 저장 위치 설정
   */
  async setDataLocation(location) {
    if (location !== 'global' && location !== 'project') {
      throw new Error('Invalid location. Use "global" or "project"');
    }

    const config = await this.readConfig();
    config.dataLocation = location;
    await this.writeConfig(config);
  }

  /**
   * 프로젝트 정보 가져오기
   */
  getProjectInfo(projectPath) {
    const projectName = path.basename(projectPath);
    return {
      name: projectName,
      path: projectPath
    };
  }

  /**
   * 글로벌 훅 경로 가져오기 (크로스 플랫폼)
   */
  getGlobalHookPath(hookName) {
    return path.join(this.globalDir, 'hooks', `${hookName}.js`);
  }

  /**
   * 세션 파일 경로 (글로벌)
   */
  getSessionFilePath() {
    return path.join(this.globalDir, 'temp', 'current-session.json');
  }

  /**
   * 로그 파일 경로 (글로벌)
   */
  getLogPath(logName) {
    return path.join(this.globalDir, 'logs', logName);
  }
}

module.exports = new GlobalConfig();
