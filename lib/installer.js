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

      // Ensure .claude directory exists
      if (!await fs.pathExists(claudeDir)) {
        await fs.ensureDir(claudeDir);
        // Create empty settings.json if it doesn't exist
        if (!await fs.pathExists(settingsPath)) {
          await fs.writeFile(settingsPath, '{}', 'utf8');
        }
      }

      // Check if already installed
      if (!options.force && await this.isInstalled(projectPath)) {
        return {
          success: false,
          error: 'ccptracker is already installed. Use --force to reinstall.'
        };
      }

      // Create ccptracker directory structure
      await this.createCcptrackerStructure(ccptrackerDir);

      // Copy hook files
      await this.copyHookFiles(ccptrackerDir);

      // Update .claude/settings.json
      await this.updateClaudeSettings(settingsPath);

      // Update .gitignore
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

      // Remove hooks from .claude/settings.json
      await this.removeClaudeSettings(settingsPath);

      // Remove ccptracker directory
      if (await fs.pathExists(ccptrackerDir)) {
        await fs.remove(ccptrackerDir);
      }

      // Remove from .gitignore
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
    const hookPath = path.join(ccptrackerDir, 'hooks', 'user-prompt-submit.js');
    return await fs.pathExists(hookPath);
  }

  async createCcptrackerStructure(ccptrackerDir) {
    // Create ccptracker directory structure
    await fs.ensureDir(path.join(ccptrackerDir, 'hooks'));
    await fs.ensureDir(path.join(ccptrackerDir, 'data'));
    await fs.ensureDir(path.join(ccptrackerDir, 'logs'));
    await fs.ensureDir(path.join(ccptrackerDir, 'temp'));

    // Create empty CSV file with headers
    const csvPath = path.join(ccptrackerDir, 'data', 'ccptracker.csv');
    if (!await fs.pathExists(csvPath)) {
      const csvHeader = 'id, project_path, project_name, request, response, star, star_desc, request_dtm, response_dtm, star_dtm, request_tokens_est, response_tokens_est, total_tokens_est, model, estimated_cost, cost_currency, actual_input_tokens, actual_output_tokens, cache_creation_tokens, cache_read_tokens\n';
      await fs.writeFile(csvPath, csvHeader, 'utf8');
    }
  }

  async copyHookFiles(ccptrackerDir) {
    const hookFiles = [
      'user-prompt-submit.js',
      'stop.js',
      'csv-updater.js',
      'stop-parse-transcript.js'
    ];

    const hooksDir = path.join(ccptrackerDir, 'hooks');

    for (const file of hookFiles) {
      const sourcePath = path.join(this.templatesDir, 'hooks', file);
      const targetPath = path.join(hooksDir, file);

      await fs.copy(sourcePath, targetPath);

      // Grant execution permissions to all hook script files
      await fs.chmod(targetPath, '755');
    }
  }

  async updateClaudeSettings(settingsPath) {
    let settings = {};

    // Read existing settings.json
    if (await fs.pathExists(settingsPath)) {
      const content = await fs.readFile(settingsPath, 'utf8');
      try {
        settings = JSON.parse(content);
      } catch (error) {
        console.log(chalk.yellow('⚠️  Existing settings.json is invalid, creating new one'));
      }
    }

    // Create hooks section if it doesn't exist
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Add ccptracker hooks
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit || [];
    settings.hooks.Stop = settings.hooks.Stop || [];

    // Remove existing ccptracker hooks (prevent duplicates)
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
      hook => !hook.hooks?.some(h => h.command?.includes('ccptracker/hooks'))
    );
    settings.hooks.Stop = settings.hooks.Stop.filter(
      hook => !hook.hooks?.some(h => h.command?.includes('ccptracker/hooks'))
    );

    // Add new hooks
    settings.hooks.UserPromptSubmit.push({
      matcher: "",
      hooks: [{
        type: "command",
        command: "./ccptracker/hooks/user-prompt-submit.js"
      }]
    });

    settings.hooks.Stop.push({
      matcher: "",
      hooks: [{
        type: "command",
        command: "./ccptracker/hooks/stop.js"
      }]
    });

    // Save settings.json
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
      return; // Return if JSON parsing fails
    }

    if (!settings.hooks) {
      return;
    }

    // Remove ccptracker hooks
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

  async updateGitignore(projectPath, hideCSV = false) {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const ccptrackerFolderEntry = 'ccptracker/*';
    const ccptrackerDataDirEntry = '!ccptracker/data/';
    const ccptrackerCsvEntry = '!ccptracker/data/ccptracker.csv';

    try {
      let content = '';

      // Read .gitignore file if it exists
      if (await fs.pathExists(gitignorePath)) {
        content = await fs.readFile(gitignorePath, 'utf8');
      }

      // Check if ccptracker/ entry already exists
      if (content.includes(ccptrackerFolderEntry)) {
        return; // Don't add if already exists
      }

      // Add ccptracker entries
      if (content && !content.endsWith('\n')) {
        content += '\n';
      }

      content += `\n# ccptracker conversation tracking data\n${ccptrackerFolderEntry}\n`;

      // Add CSV tracking only if hideCSV is false (default is to track CSV file)
      if (!hideCSV) {
        content += `${ccptrackerDataDirEntry}\n${ccptrackerCsvEntry}\n`;
      }

      await fs.writeFile(gitignorePath, content, 'utf8');
    } catch (error) {
      // .gitignore update failure is not critical, so just log it
      console.log(chalk.yellow('⚠️  Warning: Could not update .gitignore:', error.message));
    }
  }

  async removeFromGitignore(projectPath) {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const ccptrackerFolderEntry = 'ccptracker/*';
    const ccptrackerDataDirEntry = '!ccptracker/data/';
    const ccptrackerCsvEntry = '!ccptracker/data/ccptracker.csv';

    try {
      if (!await fs.pathExists(gitignorePath)) {
        return; // Do nothing if .gitignore file doesn't exist
      }

      let content = await fs.readFile(gitignorePath, 'utf8');
      const lines = content.split('\n');

      // Remove ccptracker related lines
      const filteredLines = lines.filter(line => {
        const trimmedLine = line.trim();
        return !trimmedLine.includes(ccptrackerFolderEntry) &&
               !trimmedLine.includes(ccptrackerDataDirEntry) &&
               !trimmedLine.includes(ccptrackerCsvEntry) &&
               !trimmedLine.includes('# ccptracker conversation tracking data');
      });

      // Rewrite file
      await fs.writeFile(gitignorePath, filteredLines.join('\n'), 'utf8');
    } catch (error) {
      // .gitignore update failure is not critical, so just log it
      console.log(chalk.yellow('⚠️  Warning: Could not update .gitignore:', error.message));
    }
  }
}

module.exports = new Installer();