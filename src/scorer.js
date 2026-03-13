/**
 * 贡献度评分引擎
 */
class ScoreEngine {
  constructor(config) {
    this.config = config;
    this.weights = config.weights;
    this.tiers = config.tiers;
    this.achievements = config.achievements;
  }

  calculateScore(contributor) {
    const { commits, prCreated, prMerged, issuesCreated, reviews, comments } = contributor;
    const c = commits || 0, pc = prCreated || 0, pm = prMerged || 0, ic = issuesCreated || 0, r = reviews || 0, cm = comments || 0;

    // 使用对数函数平滑分数差距
    // 新分数 = log(原始分数 + 1) × 缩放因子
    const logScale = 1000;
    
    const code = Math.log(c + 1) * logScale;
    const prScore = Math.log(pc + 1) * logScale * 2 + Math.log(pm + 1) * logScale * 3;
    const issueScore = Math.log(ic + 1) * logScale;
    const reviewScore = Math.log(r + 1) * logScale * 1.5;
    const commentScore = Math.log(cm + 1) * logScale * 0.2;

    return {
      code: Math.round(code),
      issues: Math.round(issueScore),
      reviews: Math.round(reviewScore),
      comments: Math.round(commentScore),
      total: Math.round(code + prScore + issueScore + reviewScore + commentScore)
    };
  }

  getTier(score) {
    const tierOrder = ['founder', 'elite', 'veteran', 'active', 'member'];
    for (const tierName of tierOrder) {
      const tier = this.tiers[tierName];
      if (score >= tier.min) return { name: tierName, label: tier.label, min: tier.min };
    }
    return { name: 'member', label: this.tiers.member.label, min: this.tiers.member.min };
  }

  getAchievements(contributor) {
    const commits = contributor.commits || 0;
    const prMerged = contributor.prMerged || 0;
    const comments = contributor.comments || 0;
    const totalPRs = contributor.prCreated || 1;
    const earned = [];

    if (commits >= this.achievements.centurion.threshold) earned.push(this.achievements.centurion.label);
    if (commits >= this.achievements.marathonCoder.threshold) earned.push(this.achievements.marathonCoder.label);
    if (commits >= this.achievements.commitLegend.threshold) earned.push(this.achievements.commitLegend.label);
    if (prMerged >= this.achievements.merger.threshold) earned.push(this.achievements.merger.label);
    if (comments >= this.achievements.conversationalist.threshold) earned.push(this.achievements.conversationalist.label);

    const mergeRate = prMerged / totalPRs;
    if (mergeRate >= 0.9 && totalPRs >= 3) earned.push('Precision');

    return earned;
  }

  processContributors(data) {
    console.log('Processing contributors...\n');

    const processed = data.contributors.map(contributor => {
      const score = this.calculateScore(contributor);
      const tier = this.getTier(score.total);
      const achievements = this.getAchievements(contributor);
      const commits = contributor.commits || 0;
      const reviews = contributor.reviews || 0;

      let role = 'Contributor';
      if (reviews > commits * 0.1 && reviews > 5) role = 'Reviewer';
      else if (commits > 50) role = 'Builder';

      return {
        ...contributor, score, tier, achievements, role,
        mergedPRs: contributor.prMerged || 0,
        totalPRs: contributor.prCreated || 0,
        closedPRs: contributor.prClosed || 0
      };
    });

    processed.sort((a, b) => b.score.total - a.score.total);
    processed.forEach((c, i) => c.rank = i + 1);

    console.log(`Processed ${processed.length} contributors`);
    return { ...data, contributors: processed };
  }

  generateSummary(data) {
    const c = data.contributors;
    return {
      totalContributors: c.length,
      totalCommits: c.reduce((s, x) => s + (x.commits || 0), 0),
      totalPRs: c.reduce((s, x) => s + (x.prCreated || 0), 0),
      totalMerged: c.reduce((s, x) => s + (x.prMerged || 0), 0),
      totalIssues: c.reduce((s, x) => s + (x.issuesCreated || 0), 0),
      topContributor: c[0]?.login || 'N/A',
      updatedAt: data.updatedAt
    };
  }
}

module.exports = ScoreEngine;
