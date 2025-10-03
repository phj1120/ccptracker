#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const packageJson = require('../package.json');
const installer = require('../lib/installer');
const config = require('../lib/config');

const program = new Command();

program
  .name('cctracker')
  .description('Claude Code conversation tracker and satisfaction logger')
  .version(packageJson.version);

// init 명령어 - cctracker 설치
program
  .command('init')
  .description('Initialize cctracker in the current project')
  .option('-f, --force', 'Force installation even if already exists')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Initializing cctracker...'));

      const result = await installer.install(process.cwd(), options);

      if (result.success) {
        console.log(chalk.green('✅ cctracker has been successfully installed!'));
        console.log(chalk.cyan('✅ .claude/settings.json hooks registered'));
        console.log(chalk.cyan('✅ cpm/ directory structure created'));
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

// status 명령어 - cctracker 상태 확인
program
  .command('status')
  .description('Show cctracker status and statistics')
  .action(async () => {
    try {
      const status = await config.getStatus(process.cwd());

      if (!status.installed) {
        console.log(chalk.yellow('⚠️  cctracker is not installed in this project'));
        console.log(chalk.gray('   Run "npx cctracker init" to install'));
        return;
      }

      console.log(chalk.blue('📊 cctracker Status'));
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

// remove 명령어 - cctracker 제거
program
  .command('remove')
  .description('Remove cctracker from the current project')
  .option('-f, --force', 'Force removal without confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        const inquirer = require('inquirer');
        const answers = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to remove cctracker? This will delete all conversation data.',
          default: false
        }]);

        if (!answers.confirm) {
          console.log(chalk.yellow('Operation cancelled'));
          return;
        }
      }

      console.log(chalk.blue('🗑️  Removing cctracker...'));

      const result = await installer.remove(process.cwd());

      if (result.success) {
        console.log(chalk.green('✅ cctracker has been successfully removed'));
        console.log(chalk.cyan('✅ .claude/settings.json hooks unregistered'));
        console.log(chalk.cyan('✅ cpm/ directory removed'));
      } else {
        console.log(chalk.red('❌ Removal failed:'), result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error during removal:'), error.message);
      process.exit(1);
    }
  });

// export 명령어 - 데이터 내보내기
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

// 에러 핸들링
program.on('command:*', () => {
  console.error(chalk.red('❌ Invalid command: %s'), program.args.join(' '));
  console.log(chalk.yellow('See --help for a list of available commands.'));
  process.exit(1);
});

// 프로그램 실행
if (process.argv.length === 2) {
  program.help();
} else {
  program.parse();
}