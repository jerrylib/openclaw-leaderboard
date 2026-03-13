const Handlebars = require('handlebars');
require('dotenv').config();

Handlebars.registerHelper('formatNumber', function(num) {
  return num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0';
});

// 排名显示：前三名显示奖杯
Handlebars.registerHelper('rankDisplay', function(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
});

// 分数转颜色的辅助函数
Handlebars.registerHelper('scoreColor', function(score, minScore, maxScore) {
  if (!score || !maxScore) return '0, 122, 255'; // 蓝色
  const ratio = Math.min(score / maxScore, 1);
  // 从蓝色(0, 122, 255)到红色(255, 60, 60)
  const r = Math.round(ratio * 255);
  const g = Math.round(122 * (1 - ratio) + 60 * ratio);
  const b = Math.round(255 * (1 - ratio) + 60 * ratio);
  return `${r}, ${g}, ${b}`;
});

Handlebars.registerHelper('scoreStyle', function(score, rank, total) {
  if (!score || !total) return 'color: rgb(30, 60, 120);';
  
  // 基于排名的颜色渐变
  const position = rank / total; // 0 = 第1名, 1 = 最后一名
  
  let r, g, b;
  
  if (position <= 0.02) {
    // 前2%: 深红 (150, 0, 0)
    r = 180; g = 20; b = 20;
  } else if (position <= 0.1) {
    // 前10%: 红色 -> 橙红
    const t = (position - 0.02) / 0.08;
    r = Math.round(255 - 75 * t);
    g = Math.round(50 * t);
    b = 20;
  } else if (position <= 0.2) {
    // 10-20%: 橙 -> 橙黄
    const t = (position - 0.1) / 0.1;
    r = Math.round(255);
    g = Math.round(50 + 155 * t);
    b = 0;
  } else if (position <= 0.35) {
    // 20-35%: 黄 -> 青绿
    const t = (position - 0.2) / 0.15;
    r = Math.round(255 * (1 - t));
    g = Math.round(205 + 50 * t);
    b = Math.round(200 * t);
  } else if (position <= 0.5) {
    // 35-50%: 青绿 -> 蓝色
    const t = (position - 0.35) / 0.15;
    r = Math.round(0);
    g = Math.round(255 - 85 * t);
    b = Math.round(200 * (1 - t) + 255 * t);
  } else if (position <= 0.7) {
    // 50-70%: 蓝色 -> 深蓝
    const t = (position - 0.5) / 0.2;
    r = 0;
    g = Math.round(170 - 130 * t);
    b = 255;
  } else if (position <= 0.85) {
    // 70-85%: 深蓝 -> 靛蓝
    const t = (position - 0.7) / 0.15;
    r = Math.round(30 * t);
    g = Math.round(40 - 10 * t);
    b = Math.round(255 - 35 * t);
  } else {
    // 后15%: 靛蓝 -> 深靛蓝
    const t = (position - 0.85) / 0.15;
    r = Math.round(30 + 20 * t);
    g = Math.round(30 - 10 * t);
    b = Math.round(220 - 40 * t);
  }
  
  return `color: rgb(${r}, ${g}, ${b}); font-weight: 700;`;
});

class StaticGenerator {
  constructor(config) {
    this.config = config;
    this.outputDir = require('path').resolve(config.outputDir || './output');
  }

  async generate(data) {
    console.log('Generating static site...');
    const fs = require('fs-extra');
    await fs.ensureDir(this.outputDir);
    await fs.ensureDir(require('path').join(this.outputDir, 'css'));
    await fs.ensureDir(require('path').join(this.outputDir, 'js'));
    
    // 计算最大分数
    const maxScore = Math.max(...data.contributors.map(c => c.score?.total || 0));
    data.maxScore = maxScore;
    
    await this.generateIndex(data);
    await this.generateProfiles(data);
    await this.copyAssets();
    console.log(`Static site generated to ${this.outputDir}`);
  }

  async generateIndex(data) {
    const template = this.getIndexTemplate();
    const compiled = Handlebars.compile(template);
    const summary = {
      totalContributors: data.contributors.length,
      totalStars: data.repo.stargazers_count || 0,
      totalForks: data.repo.forks_count || 0,
      updatedAt: new Date(data.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    };
    const html = compiled({ repo: data.repo, summary, contributors: data.contributors, totalContributors: data.contributors.length });
    const fs = require('fs-extra');
    await fs.writeFile(require('path').join(this.outputDir, 'index.html'), html);
  }

  async generateProfiles(data) {
    const template = this.getProfileTemplate();
    const compiled = Handlebars.compile(template);
    const fs = require('fs-extra');
    for (const contributor of data.contributors) {
      const html = compiled({ repo: data.repo, contributor, updatedAt: new Date(data.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), maxScore: data.maxScore });
      const profileDir = require('path').join(this.outputDir, 'profile');
      await fs.ensureDir(profileDir);
      await fs.writeFile(require('path').join(profileDir, `${contributor.login}.html`), html);
    }
  }

  async copyAssets() {
    const fs = require('fs-extra');
    await fs.writeFile(require('path').join(this.outputDir, 'css', 'style.css'), this.getCSS());
    await fs.writeFile(require('path').join(this.outputDir, 'js', 'main.js'), this.getJS());
  }

  getIndexTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{repo.full_name}} - Contributor Leaderboard</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="banner"><div class="container"><a href="/" class="logo">{{repo.full_name}} Leaderboard</a><a href="{{repo.html_url}}" class="github-link" target="_blank">GitHub</a></div></header>
  <main class="container">
    <section class="hero">
      <h1>{{repo.name}}</h1>
      <p class="subtitle">{{repo.description}}</p>
      <p class="updated">Updated {{summary.updatedAt}}</p>
      <div class="stats">
        <div class="stat"><span class="stat-value">{{summary.totalContributors}}</span><span class="stat-label">contributors</span></div>
        <div class="stat"><span class="stat-value">{{formatNumber summary.totalStars}}</span><span class="stat-label">stars</span></div>
        <div class="stat"><span class="stat-value">{{formatNumber summary.totalForks}}</span><span class="stat-label">forks</span></div>
      </div>
      <input type="text" class="search-box" placeholder="Search contributors..." id="searchInput">
    </section>
    <section class="leaderboard">
      <div class="leaderboard-header"><span>#</span><span>Contributor</span><span>Class</span><span>Score</span></div>
      {{#each contributors}}
      <a href="profile/{{login}}.html" class="contributor-row">
        <span class="rank">{{rankDisplay rank}}</span>
        <div class="contributor-info"><img src="{{avatar_url}}" alt="{{login}}" class="avatar"><div class="contributor-name"><span class="name">{{login}}</span><span class="github-link-text">on GitHub</span></div></div>
        <span class="tier {{tier.name}}">{{tier.label}}</span>
        <span class="score" style="{{scoreStyle score.total rank ../totalContributors}}">{{formatNumber score.total}}pts</span>
      </a>
      {{/each}}
    </section>
  </main>
  <script src="js/main.js"></script>
</body>
</html>`;
  }

  getProfileTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{contributor.login}} - Contributor Profile</title>
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <header class="banner"><div class="container"><a href="/" class="logo">{{repo.full_name}} Leaderboard</a><a href="{{repo.html_url}}" class="github-link" target="_blank">GitHub</a></div></header>
  <main class="container">
    <a href="/" class="back-link">← Back to Leaderboard</a>
    <section class="profile-header">
      <img src="{{contributor.avatar_url}}" alt="{{contributor.login}}" class="profile-avatar">
      <h1>{{contributor.login}}</h1>
      <a href="https://github.com/{{contributor.login}}" class="profile-github" target="_blank">{{contributor.login}} on GitHub</a>
      <p class="profile-role {{contributor.tier.name}}">{{contributor.tier.label}} • {{contributor.role}}</p>
      <p class="profile-score" style="{{scoreStyle contributor.score.total ../maxScore}}">{{formatNumber contributor.score.total}} total points</p>
    </section>
    <section class="profile-stats">
      <div class="stat-card"><span class="stat-value">{{formatNumber contributor.commits}}</span><span class="stat-label">Commits</span></div>
      <div class="stat-card"><span class="stat-value">{{contributor.totalPRs}}</span><span class="stat-label">PRs Created</span></div>
      <div class="stat-card"><span class="stat-value">{{contributor.mergedPRs}}</span><span class="stat-label">PRs Merged</span></div>
      <div class="stat-card"><span class="stat-value">{{contributor.closedPRs}}</span><span class="stat-label">PRs Closed</span></div>
      <div class="stat-card"><span class="stat-value">{{formatNumber contributor.issuesCreated}}</span><span class="stat-label">Issues</span></div>
      <div class="stat-card"><span class="stat-value">{{formatNumber contributor.reviews}}</span><span class="stat-label">Reviews</span></div>
    </section>
    <section class="score-breakdown">
      <h2>Score Breakdown</h2>
      <div class="breakdown-grid">
        <div class="breakdown-item"><span class="breakdown-label">Code (Commits)</span><span class="breakdown-value">{{formatNumber contributor.score.code}}pts</span></div>
        <div class="breakdown-item"><span class="breakdown-label">Issues</span><span class="breakdown-value">{{formatNumber contributor.score.issues}}pts</span></div>
        <div class="breakdown-item"><span class="breakdown-label">Reviews</span><span class="breakdown-value">{{formatNumber contributor.score.reviews}}pts</span></div>
        <div class="breakdown-item"><span class="breakdown-label">Comments</span><span class="breakdown-value">{{formatNumber contributor.score.comments}}pts</span></div>
      </div>
    </section>
    {{#if contributor.achievements.length}}
    <section class="achievements"><h2>Achievements</h2><div class="achievements-grid">{{#each contributor.achievements}}<span class="achievement-badge">{{this}}</span>{{/each}}</div></section>
    {{/if}}
  </main>
</body>
</html>`;
  }

  getCSS() { return `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#24292f;line-height:1.5}.container{max-width:1200px;margin:0 auto;padding:0 20px}.banner{background:#f6f8fa;border-bottom:1px solid #d0d7de;padding:16px 0;position:sticky;top:0;z-index:100}.banner .container{display:flex;justify-content:space-between;align-items:center}.logo{font-size:20px;font-weight:600;color:#24292f;text-decoration:none}.github-link{color:#57606a;text-decoration:none;font-size:14px}.hero{text-align:center;padding:60px 0 40px}.hero h1{font-size:48px;font-weight:700;margin-bottom:8px}.subtitle{font-size:18px;color:#57606a;margin-bottom:8px}.updated{font-size:14px;color:#57606a;margin-bottom:32px}.stats{display:flex;justify-content:center;gap:40px;margin-bottom:32px}.stat{display:flex;flex-direction:column}.stat-value{font-size:32px;font-weight:700}.stat-label{font-size:14px;color:#57606a}.search-box{width:100%;max-width:400px;padding:12px 16px;border:1px solid #d0d7de;border-radius:6px;font-size:14px;margin-bottom:40px}.search-box:focus{outline:none;border-color:#0969da;box-shadow:0 0 0 3px rgba(9,105,218,.1)}.leaderboard{border:1px solid #d0d7de;border-radius:6px;overflow:hidden}.leaderboard-header{display:grid;grid-template-columns:60px 1fr 150px 120px;padding:12px 20px;background:#f6f8fa;border-bottom:1px solid #d0d7de;font-weight:600;font-size:14px;color:#57606a}.leaderboard-header span{display:flex;align-items:center}.leaderboard-header span:first-child{justify-content:center}.leaderboard-header span:last-child{justify-content:flex-end}.contributor-row{display:grid;grid-template-columns:60px 1fr 150px 120px;padding:16px 20px;border-bottom:1px solid #d0d7de;text-decoration:none;color:#24292f;align-items:center}.contributor-row>span{display:flex;align-items:center}.contributor-row>span:first-child{justify-content:center}.contributor-row>span:last-child{justify-content:flex-end}.contributor-row:last-child{border-bottom:none}.contributor-row:hover{background:#f6f8fa}.rank{font-weight:700;font-size:18px;color:#57606a;text-align:center}.contributor-info{display:flex;align-items:center;gap:12px}.avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0}.contributor-name{display:flex;flex-direction:column;min-width:0}.name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.github-link-text{font-size:12px;color:#57606a}.tier{font-size:13px;font-weight:500;padding:4px 10px;border-radius:20px;text-align:center;justify-content:center}.tier.founder{background:#ffebe9;color:#cf222e}.tier.elite{background:#fff8c5;color:#bf8700}.tier.veteran{background:#dafbe1;color:#1a7f37}.tier.active{background:#ddf4ff;color:#0969da}.tier.member{background:#eff1f3;color:#57606a}.score{text-align:right;justify-content:flex-end}.back-link{display:inline-block;color:#0969da;text-decoration:none;margin:24px 0}.profile-header{text-align:center;padding:40px 0}.profile-avatar{width:120px;height:120px;border-radius:50%;margin-bottom:16px}.profile-header h1{font-size:36px;margin-bottom:8px}.profile-github{color:#0969da;text-decoration:none;font-size:16px}.profile-role{margin-top:12px;font-size:18px;font-weight:500}.profile-score{margin-top:8px;font-size:24px}.profile-stats{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin-bottom:40px}.stat-card{background:#f6f8fa;border-radius:6px;padding:20px;text-align:center}.stat-card .stat-value{font-size:24px;font-weight:700}.stat-card .stat-label{font-size:13px;color:#57606a;margin-top:4px}.score-breakdown{margin-bottom:40px}.score-breakdown h2,.achievements h2{font-size:20px;margin-bottom:16px}.breakdown-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.breakdown-item{background:#f6f8fa;border-radius:6px;padding:16px;display:flex;justify-content:space-between}.breakdown-label{color:#57606a}.breakdown-value{font-weight:600}.achievements-grid{display:flex;flex-wrap:wrap;gap:8px}.achievement-badge{background:linear-gradient(135deg,#0969da,#1a7f37);color:#fff;padding:8px 16px;border-radius:20px;font-size:14px;font-weight:500}@media(max-width:768px){.hero h1{font-size:32px}.stats{gap:20px}.stat-value{font-size:24px}.leaderboard-header,.contributor-row{grid-template-columns:50px 1fr 80px}.score{display:none}.profile-stats,.breakdown-grid{grid-template-columns:repeat(3,1fr)}}`; }

  getJS() { return `document.addEventListener('DOMContentLoaded',function(){const e=document.getElementById('searchInput');if(e){e.addEventListener('input',function(e){const t=e.target.value.toLowerCase(),n=document.querySelectorAll('.contributor-row');n.forEach(function(e){const n=e.querySelector('.name').textContent.toLowerCase();e.style.display=n.includes(t)?'grid':'none'})})}document.querySelectorAll('.filter-btn').forEach(function(e){e.addEventListener('click',function(){document.querySelectorAll('.filter-btn').forEach(function(e){e.classList.remove('active')});this.classList.add('active')})})});`; }
}

module.exports = StaticGenerator;
