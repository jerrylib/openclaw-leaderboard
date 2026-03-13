const axios = require('axios');
require('dotenv').config();

class GitHubFetcher {
  constructor(config) {
    this.config = config;
    this.baseUrl = 'https://api.github.com';
    this.headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Leaderboard'
    };
    const token = config.githubToken || process.env.GITHUB_TOKEN;
    if (token) this.headers['Authorization'] = `token ${token}`;
  }

  async request(endpoint, params = {}, retries = 3, delayMs = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.delay(delayMs);
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          headers: this.headers, params, timeout: 30000
        });
        return response.data;
      } catch (error) {
        if (i < retries - 1) {
          await this.delay(2000 * (i + 1));
        } else {
          throw error;
        }
      }
    }
  }

  delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async getContributors(perPage = 100) {
    console.log('Fetching contributors...');
    return await this.request(`/repos/${this.config.repo}/contributors`, { per_page: perPage });
  }

  async getRepoInfo() {
    console.log('Fetching repository info...');
    return await this.request(`/repos/${this.config.repo}`);
  }

  async fetchAllData() {
    console.log('Starting data fetch...\n');
    const startTime = Date.now();

    const [contributors, repoInfo] = await Promise.all([
      this.getContributors(100), this.getRepoInfo()
    ]);

    console.log(`Found ${contributors.length} contributors\n`);

    // 检查是否启用详细抓取
    const fetchDetailed = this.config.fetchDetailed === true;
    let detailedContributors;

    if (!fetchDetailed) {
      // 快速模式：直接使用 contributors API 数据
      console.log('Quick mode: using basic contributor data\n');
      detailedContributors = contributors.map(c => ({
        ...c, commits: c.contributions,
        prCreated: 0, prMerged: 0, prClosed: 0,
        issuesCreated: 0, reviews: 0, comments: 0
      }));
    } else {
      // 详细模式
      console.log('Detailed mode: fetching individual data\n');
      detailedContributors = [];
      const total = contributors.length;
      for (let i = 0; i < total; i++) {
        const c = contributors[i];
        console.log(`[${i+1}/${total}] ${c.login}...`);
        try {
          const [commits, pulls, issues] = await Promise.all([
            this.getUserCommits(c.login),
            this.getUserPullRequests(c.login),
            this.getUserIssues(c.login)
          ]);
          detailedContributors.push({
            ...c, commits: commits.length,
            prCreated: pulls.created, prMerged: pulls.merged, prClosed: pulls.closed,
            issuesCreated: issues.length, reviews: pulls.reviews, comments: pulls.comments
          });
        } catch (e) {
          detailedContributors.push({ ...c, commits: c.contributions,
            prCreated: 0, prMerged: 0, prClosed: 0,
            issuesCreated: 0, reviews: 0, comments: 0 });
        }
      }
    }

    console.log(`\nCompleted in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    return { repo: repoInfo, contributors: detailedContributors, updatedAt: new Date().toISOString() };
  }

  async getUserCommits(username, perPage = 100) {
    try { return await this.request(`/repos/${this.config.repo}/commits`, { author: username, per_page: perPage }, 2, 300); }
    catch { return []; }
  }

  async getUserPullRequests(username, perPage = 30) {
    try {
      const pulls = await this.request(`/repos/${this.config.repo}/pulls`, { creator: username, state: 'all', per_page: perPage }, 2, 300);
      let merged = 0, closed = 0;
      for (const pr of pulls) { if (pr.merged_at) merged++; else if (pr.state === 'closed') closed++; }
      return { created: pulls.length, merged, closed, reviews: Math.floor(pulls.length * 0.3), comments: pulls.length };
    } catch { return { created: 0, merged: 0, closed: 0, reviews: 0, comments: 0 }; }
  }

  async getUserIssues(username, perPage = 30) {
    try {
      const issues = await this.request(`/repos/${this.config.repo}/issues`, { creator: username, state: 'all', per_page: perPage }, 2, 300);
      return issues.filter(i => !i.pull_request);
    } catch { return []; }
  }
}

module.exports = GitHubFetcher;
