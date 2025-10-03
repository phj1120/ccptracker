const installer = require('./installer');
const config = require('./config');

module.exports = {
  installer,
  config,

  // 편의 메서드
  async install(projectPath, options = {}) {
    return await installer.install(projectPath, options);
  },

  async remove(projectPath) {
    return await installer.remove(projectPath);
  },

  async status(projectPath) {
    return await config.getStatus(projectPath);
  },

  async export(projectPath, options = {}) {
    return await config.exportData(projectPath, options);
  },

  async isInstalled(projectPath) {
    return await installer.isInstalled(projectPath);
  }
};