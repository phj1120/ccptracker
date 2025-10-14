const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

class Config {
  constructor() {
    this.globalDir = path.join(os.homedir(), '.ccptracker');
    this.globalConfigPath = path.join(this.globalDir, 'config.json');
  }

  /**
   * Get global ccptracker directory path
   */
  getGlobalDir() {
    return this.globalDir;
  }

  /**
   * Get global configuration
   */
  async getGlobalConfig() {
    await this.ensureGlobalDir();

    if (!await fs.pathExists(this.globalConfigPath)) {
      // Create default config
      const defaultConfig = {
        dataLocation: 'global',  // 'global' | 'project'
        csvPath: path.join(this.globalDir, 'data', 'ccptracker.csv')
      };
      await fs.writeFile(this.globalConfigPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      return defaultConfig;
    }

    const content = await fs.readFile(this.globalConfigPath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Update global configuration
   */
  async updateGlobalConfig(updates) {
    const config = await this.getGlobalConfig();
    const newConfig = { ...config, ...updates };
    await fs.writeFile(this.globalConfigPath, JSON.stringify(newConfig, null, 2), 'utf8');
    return newConfig;
  }

  /**
   * Ensure global directory exists
   */
  async ensureGlobalDir() {
    await fs.ensureDir(this.globalDir);
    await fs.ensureDir(path.join(this.globalDir, 'hooks'));
    await fs.ensureDir(path.join(this.globalDir, 'data'));
    await fs.ensureDir(path.join(this.globalDir, 'temp'));
    await fs.ensureDir(path.join(this.globalDir, 'logs'));
  }

  /**
   * Get CSV path based on configuration
   */
  async getCsvPath(projectPath = null) {
    const config = await this.getGlobalConfig();

    if (config.dataLocation === 'project' && projectPath) {
      return path.join(projectPath, 'ccptracker', 'data', 'ccptracker.csv');
    }

    return config.csvPath;
  }

  /**
   * Get status for project or global
   */
  async getStatus(projectPath) {
    const config = await this.getGlobalConfig();
    const csvPath = await this.getCsvPath(projectPath);
    const globalHookPath = path.join(this.globalDir, 'hooks', 'user-prompt-submit.js');
    const projectHookPath = path.join(projectPath, 'ccptracker', 'hooks', 'user-prompt-submit');

    const status = {
      installed: await fs.pathExists(globalHookPath) || await fs.pathExists(projectHookPath),
      installType: await fs.pathExists(globalHookPath) ? 'global' : 'project',
      dataLocation: config.dataLocation,
      totalConversations: 0,
      averageRating: 0,
      lastConversation: null,
      dataPath: csvPath
    };

    if (!status.installed) {
      return status;
    }

    // Analyze CSV data
    if (await fs.pathExists(csvPath)) {
      let conversations = await this.readCsvData(csvPath);

      // Filter by project if global mode
      if (config.dataLocation === 'global' && projectPath) {
        conversations = conversations.filter(conv => conv.project_path === projectPath);
      }

      status.totalConversations = conversations.length;

      if (conversations.length > 0) {
        // Calculate average rating
        const ratings = conversations
          .filter(conv => conv.star && !isNaN(parseFloat(conv.star)))
          .map(conv => parseFloat(conv.star));

        if (ratings.length > 0) {
          status.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        }

        // Last conversation time
        const lastConv = conversations[conversations.length - 1];
        if (lastConv.request_dtm) {
          status.lastConversation = lastConv.request_dtm;
        }
      }
    }

    return status;
  }

  async exportData(projectPath, options) {
    const csvPath = await this.getCsvPath(projectPath);
    const config = await this.getGlobalConfig();

    if (!await fs.pathExists(csvPath)) {
      return {
        success: false,
        error: 'No conversation data found'
      };
    }

    let conversations = await this.readCsvData(csvPath);

    // Filter by project if global mode
    if (config.dataLocation === 'global' && projectPath) {
      conversations = conversations.filter(conv => conv.project_path === projectPath);
    }

    if (conversations.length === 0) {
      return {
        success: false,
        error: 'No conversations to export'
      };
    }

    const format = options.format || 'csv';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultFileName = `ccptracker-export-${timestamp}.${format}`;
    const outputPath = options.output || path.join(projectPath, defaultFileName);

    try {
      if (format === 'json') {
        await this.exportAsJson(conversations, outputPath);
      } else if (format === 'csv') {
        await this.exportAsCsv(conversations, outputPath);
      } else {
        return {
          success: false,
          error: `Unsupported format: ${format}`
        };
      }

      return {
        success: true,
        filePath: outputPath,
        recordCount: conversations.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async readCsvData(csvPath) {
    return new Promise((resolve, reject) => {
      const results = [];

      if (!fs.existsSync(csvPath)) {
        resolve([]);
        return;
      }

      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async exportAsJson(conversations, outputPath) {
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalConversations: conversations.length,
      conversations: conversations.map(conv => ({
        id: conv.id,
        request: conv.request,
        response: conv.response,
        rating: conv.star ? parseInt(conv.star) : null,
        ratingComment: conv.star_desc || null,
        requestTime: conv.request_dtm,
        responseTime: conv.response_dtm,
        ratingTime: conv.star_dtm
      }))
    };

    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
  }

  async exportAsCsv(conversations, outputPath) {
    // Copying original CSV as-is is the safest approach
    const sourcePath = path.dirname(outputPath);
    await fs.ensureDir(sourcePath);

    // Reorganize headers and data for export
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'project_path', title: 'Project Path' },
        { id: 'project_name', title: 'Project Name' },
        { id: 'request', title: 'Request' },
        { id: 'response', title: 'Response' },
        { id: 'star', title: 'Rating' },
        { id: 'star_desc', title: 'Rating Comment' },
        { id: 'request_dtm', title: 'Request Time' },
        { id: 'response_dtm', title: 'Response Time' },
        { id: 'star_dtm', title: 'Rating Time' }
      ]
    });

    await csvWriter.writeRecords(conversations);
  }

  async getConversationStats(projectPath) {
    const status = await this.getStatus(projectPath);

    if (!status.installed) {
      return null;
    }

    const csvPath = await this.getCsvPath(projectPath);
    const config = await this.getGlobalConfig();

    if (!await fs.pathExists(csvPath)) {
      return {
        total: 0,
        rated: 0,
        unrated: 0,
        averageRating: 0,
        ratingDistribution: {}
      };
    }

    let conversations = await this.readCsvData(csvPath);

    // Filter by project if global mode
    if (config.dataLocation === 'global' && projectPath) {
      conversations = conversations.filter(conv => conv.project_path === projectPath);
    }

    const ratedConversations = conversations.filter(conv => conv.star && !isNaN(parseFloat(conv.star)));

    const stats = {
      total: conversations.length,
      rated: ratedConversations.length,
      unrated: conversations.length - ratedConversations.length,
      averageRating: 0,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    };

    if (ratedConversations.length > 0) {
      const ratings = ratedConversations.map(conv => parseFloat(conv.star));
      stats.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

      // Calculate rating distribution
      ratings.forEach(rating => {
        const roundedRating = Math.round(rating).toString();
        if (stats.ratingDistribution.hasOwnProperty(roundedRating)) {
          stats.ratingDistribution[roundedRating]++;
        }
      });
    }

    return stats;
  }
}

module.exports = new Config();