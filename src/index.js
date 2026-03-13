require('dotenv').config();
const GitHubFetcher = require('./fetcher');
const ScoreEngine = require('./scorer');
const StaticGenerator = require('./generator');
const fs = require('fs-extra');
const path = require('path');

class Leaderboard {
  constructor(configPath = './config.json') {
    this.config = require(path.resolve(configPath));
    this.fetcher = new GitHubFetcher(this.config);
    this.scorer = new ScoreEngine(this.config);
    this.generator = new StaticGenerator(this.config);
  }

  async run() {
    console.log('=== GitHub Leaderboard Generator ===\n');
    
    try {
      // 1. 抓取数据
      console.log('[Step 1/3] Fetching data from GitHub...');
      const rawData = await this.fetcher.fetchAllData();
      
      // 保存原始数据
      const dataDir = path.join(this.config.outputDir || './output', 'data');
      await fs.ensureDir(dataDir);
      await fs.writeFile(
        path.join(dataDir, 'raw.json'), 
        JSON.stringify(rawData, null, 2)
      );

      // 2. 计算得分
      console.log('[Step 2/3] Calculating scores...');
      const processedData = this.scorer.processContributors(rawData);
      const summary = this.scorer.generateSummary(processedData);
      
      console.log('\n📊 Summary:');
      console.log(`   Total Contributors: ${summary.totalContributors}`);
      console.log(`   Total Commits: ${summary.totalCommits}`);
      console.log(`   Total PRs: ${summary.totalPRs}`);
      console.log(`   Total Merged: ${summary.totalMerged}`);

      // 保存处理后的数据
      await fs.writeFile(
        path.join(dataDir, 'processed.json'),
        JSON.stringify(processedData, null, 2)
      );

      // 3. 生成静态页面
      console.log('\n[Step 3/3] Generating static site...');
      await this.generator.generate(processedData);

      console.log('\n✅ Leaderboard generated successfully!');
      console.log(`📁 Output: ${path.resolve(this.config.outputDir || './output')}`);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

// Main entry
if (require.main === module) {
  const configPath = process.argv[2] || './config.json';
  const leaderboard = new Leaderboard(configPath);
  leaderboard.run();
}

module.exports = Leaderboard;
