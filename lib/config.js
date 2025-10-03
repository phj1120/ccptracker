const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

class Config {
  async getStatus(projectPath) {
    const cctrackerDir = path.join(projectPath, 'cctracker');
    const csvPath = path.join(cctrackerDir, 'data', 'ccptracker.csv');
    const hookPath = path.join(cctrackerDir, 'hooks', 'user-prompt-submit');

    const status = {
      installed: await fs.pathExists(hookPath),
      totalConversations: 0,
      averageRating: 0,
      lastConversation: null,
      dataPath: csvPath
    };

    if (!status.installed) {
      return status;
    }

    // CSV 데이터 분석
    if (await fs.pathExists(csvPath)) {
      const conversations = await this.readCsvData(csvPath);
      status.totalConversations = conversations.length;

      if (conversations.length > 0) {
        // 평균 평점 계산
        const ratings = conversations
          .filter(conv => conv.star && !isNaN(parseFloat(conv.star)))
          .map(conv => parseFloat(conv.star));

        if (ratings.length > 0) {
          status.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        }

        // 마지막 대화 시간
        const lastConv = conversations[conversations.length - 1];
        if (lastConv.request_dtm) {
          status.lastConversation = lastConv.request_dtm;
        }
      }
    }

    return status;
  }

  async exportData(projectPath, options) {
    const cctrackerDir = path.join(projectPath, 'cctracker');
    const csvPath = path.join(cctrackerDir, 'data', 'ccptracker.csv');

    if (!await fs.pathExists(csvPath)) {
      return {
        success: false,
        error: 'No conversation data found'
      };
    }

    const conversations = await this.readCsvData(csvPath);

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
    // 원본 CSV를 그대로 복사하는 것이 가장 안전
    const sourcePath = path.dirname(outputPath);
    await fs.ensureDir(sourcePath);

    // 헤더와 데이터를 다시 정리해서 export
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'id', title: 'ID' },
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

    const cctrackerDir = path.join(projectPath, 'cctracker');
    const csvPath = path.join(cctrackerDir, 'data', 'ccptracker.csv');

    if (!await fs.pathExists(csvPath)) {
      return {
        total: 0,
        rated: 0,
        unrated: 0,
        averageRating: 0,
        ratingDistribution: {}
      };
    }

    const conversations = await this.readCsvData(csvPath);
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

      // 평점 분포 계산
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