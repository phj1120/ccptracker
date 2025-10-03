#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const packageJson = require('../package.json');
const installer = require('../lib/installer');
const config = require('../lib/config');

const program = new Command();

program
  .name('ccptracker')
  .description('Claude Code conversation tracker and satisfaction logger')
  .version(packageJson.version);

// init command - ccptracker installation
program
  .command('init')
  .description('Initialize ccptracker in the current project')
  .option('-f, --force', 'Force installation even if already exists')
  .option('--githide', 'Hide CSV data file in .gitignore (by default CSV file is tracked)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Initializing ccptracker...'));

      const result = await installer.install(process.cwd(), options);

      if (result.success) {
        console.log(chalk.green('✅ ccptracker has been successfully installed!'));
        console.log(chalk.cyan('✅ .claude/settings.json hooks registered'));
        console.log(chalk.cyan('✅ ccptracker/ directory structure created'));

        if (options.githide) {
          console.log(chalk.cyan('✅ .gitignore updated to ignore ccptracker/ folder and CSV file'));
        } else {
          console.log(chalk.cyan('✅ .gitignore updated to ignore ccptracker/ folder (CSV file will be tracked)'));
        }

        console.log(chalk.yellow('\n💡 Start using Claude Code and your conversations will be tracked automatically!'));
        console.log(chalk.gray('   Rate conversations with 1-5 after each response.'));
      } else {
        console.log(chalk.red('❌ Installation failed:'), result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error during installation:'), error.message);
      process.exit(1);
    }
  });

// status command - check ccptracker status
program
  .command('status')
  .description('Show ccptracker status and statistics')
  .action(async () => {
    try {
      const status = await config.getStatus(process.cwd());

      if (!status.installed) {
        console.log(chalk.yellow('⚠️  ccptracker is not installed in this project'));
        console.log(chalk.gray('   Run "npx ccptracker init" to install'));
        return;
      }

      console.log(chalk.blue('📊 ccptracker Status'));
      console.log(chalk.green('✅ Installed and configured'));
      console.log(`📝 Total conversations: ${chalk.cyan(status.totalConversations)}`);

      if (status.averageRating > 0) {
        const stars = '⭐'.repeat(Math.round(status.averageRating));
        console.log(`⭐ Average satisfaction: ${chalk.cyan(status.averageRating.toFixed(1))}/5 ${stars}`);
      }

      if (status.lastConversation) {
        console.log(`🕒 Last conversation: ${chalk.gray(status.lastConversation)}`);
      }

      console.log(`📁 Data location: ${chalk.gray(status.dataPath)}`);

    } catch (error) {
      console.error(chalk.red('❌ Error getting status:'), error.message);
      process.exit(1);
    }
  });

// remove command - ccptracker removal
program
  .command('remove')
  .description('Remove ccptracker from the current project')
  .option('-f, --force', 'Force removal without confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        const inquirer = require('inquirer');
        const answers = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to remove ccptracker? This will delete all conversation data.',
          default: false
        }]);

        if (!answers.confirm) {
          console.log(chalk.yellow('Operation cancelled'));
          return;
        }
      }

      console.log(chalk.blue('🗑️  Removing ccptracker...'));

      const result = await installer.remove(process.cwd());

      if (result.success) {
        console.log(chalk.green('✅ ccptracker has been successfully removed'));
        console.log(chalk.cyan('✅ .claude/settings.json hooks unregistered'));
        console.log(chalk.cyan('✅ ccptracker/ directory removed'));
        console.log(chalk.cyan('✅ .gitignore updated to remove ccptracker/ entry'));
      } else {
        console.log(chalk.red('❌ Removal failed:'), result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error during removal:'), error.message);
      process.exit(1);
    }
  });

// export command - data export
program
  .command('export')
  .description('Export conversation data to different formats')
  .option('-f, --format <format>', 'Export format (csv, json)', 'csv')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      const result = await config.exportData(process.cwd(), options);

      if (result.success) {
        console.log(chalk.green(`✅ Data exported to: ${result.filePath}`));
        console.log(chalk.cyan(`📊 ${result.recordCount} conversations exported`));
      } else {
        console.log(chalk.red('❌ Export failed:'), result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error during export:'), error.message);
      process.exit(1);
    }
  });

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('❌ Invalid command: %s'), program.args.join(' '));
  console.log(chalk.yellow('See --help for a list of available commands.'));
  process.exit(1);
});

// Program execution
if (process.argv.length === 2) {
  program.help();
} else {
  program.parse();
}