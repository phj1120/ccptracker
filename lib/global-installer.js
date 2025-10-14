const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const globalConfig = require('./global-config');

class GlobalInstaller {
  constructor() {
    this.templatesDir = path.join(__dirname, '../templates');
  }

  /**
   * Install global hooks
   */
  async installGlobal(options = {}) {
    try {
      // Ensure global directory structure
      await globalConfig.ensureGlobalStructure();

      // Copy hook files to global directory
      await this.copyGlobalHookFiles();

      // Update user's Claude settings
      await this.updateClaudeSettings(options.force);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Remove global hooks
   */
  async removeGlobal() {
    try {
      // Remove hooks from Claude settings
      await this.removeClaudeSettings();

      // Optionally remove global directory (ask user first)
      // For now, we keep the data and just remove hooks from settings

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Copy hook files to global directory
   */
  async copyGlobalHookFiles() {
    const hookFiles = [
      'user-prompt-submit.js',
      'stop.js',
      'csv-updater-global.js',
      'stop-parse-transcript.js'
    ];

    const globalHooksDir = path.join(globalConfig.globalDir, 'hooks');
    await fs.ensureDir(globalHooksDir);

    for (const file of hookFiles) {
      const sourcePath = path.join(this.templatesDir, 'hooks', file);
      const targetPath = path.join(globalHooksDir, file);

      await fs.copy(sourcePath, targetPath);

      // Make executable (Unix-like systems)
      if (process.platform !== 'win32') {
        await fs.chmod(targetPath, '755');
      }
    }
  }

  /**
   * Update Claude settings to use global hooks
   */
  async updateClaudeSettings(force = false) {
    const claudeDir = path.join(require('os').homedir(), '.claude');
    const settingsPath = path.join(claudeDir, 'settings.json');

    // Ensure .claude directory exists
    await fs.ensureDir(claudeDir);

    let settings = {};

    // Read existing settings.json
    if (await fs.pathExists(settingsPath)) {
      const content = await fs.readFile(settingsPath, 'utf8');
      try {
        settings = JSON.parse(content);
      } catch (error) {
        if (!force) {
          throw new Error('Existing settings.json is invalid. Use --force to overwrite.');
        }
        console.log(chalk.yellow('⚠️  Existing settings.json is invalid, creating new one'));
      }
    }

    // Create hooks section if it doesn't exist
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Add ccptracker global hooks
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit || [];
    settings.hooks.Stop = settings.hooks.Stop || [];

    // Remove existing ccptracker hooks (both local and global)
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
      hook => !hook.hooks?.some(h =>
        h.command?.includes('ccptracker/hooks') ||
        h.command?.includes('.ccptracker/hooks')
      )
    );
    settings.hooks.Stop = settings.hooks.Stop.filter(
      hook => !hook.hooks?.some(h =>
        h.command?.includes('ccptracker/hooks') ||
        h.command?.includes('.ccptracker/hooks')
      )
    );

    // Add new global hooks
    const userPromptSubmitPath = globalConfig.getGlobalHookPath('user-prompt-submit');
    const stopPath = globalConfig.getGlobalHookPath('stop');

    settings.hooks.UserPromptSubmit.push({
      matcher: "",
      hooks: [{
        type: "command",
        command: `node "${userPromptSubmitPath}"`
      }]
    });

    settings.hooks.Stop.push({
      matcher: "",
      hooks: [{
        type: "command",
        command: `node "${stopPath}"`
      }]
    });

    // Save settings.json
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }

  /**
   * Remove ccptracker hooks from Claude settings
   */
  async removeClaudeSettings() {
    const claudeDir = path.join(require('os').homedir(), '.claude');
    const settingsPath = path.join(claudeDir, 'settings.json');

    if (!await fs.pathExists(settingsPath)) {
      return;
    }

    const content = await fs.readFile(settingsPath, 'utf8');
    let settings;

    try {
      settings = JSON.parse(content);
    } catch (error) {
      return; // Return if JSON parsing fails
    }

    if (!settings.hooks) {
      return;
    }

    // Remove ccptracker hooks (both local and global)
    if (settings.hooks.UserPromptSubmit) {
      settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
        hook => !hook.hooks?.some(h =>
          h.command?.includes('ccptracker/hooks') ||
          h.command?.includes('.ccptracker/hooks')
        )
      );
    }

    if (settings.hooks.Stop) {
      settings.hooks.Stop = settings.hooks.Stop.filter(
        hook => !hook.hooks?.some(h =>
          h.command?.includes('ccptracker/hooks') ||
          h.command?.includes('.ccptracker/hooks')
        )
      );
    }

    // Remove if empty arrays
    if (settings.hooks.UserPromptSubmit?.length === 0) {
      delete settings.hooks.UserPromptSubmit;
    }
    if (settings.hooks.Stop?.length === 0) {
      delete settings.hooks.Stop;
    }

    // Remove hooks if empty object
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }

  /**
   * Check if global hooks are installed
   */
  async isInstalled() {
    const hookPath = globalConfig.getGlobalHookPath('user-prompt-submit');
    return await fs.pathExists(hookPath);
  }

  /**
   * Set data location (global or project)
   */
  async setDataLocation(location) {
    await globalConfig.setDataLocation(location);
  }

  /**
   * Get current configuration
   */
  async getConfig() {
    return await globalConfig.readConfig();
  }
}

module.exports = new GlobalInstaller();
