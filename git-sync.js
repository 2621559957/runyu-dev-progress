const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

const PORT = 3333;
const REPO_DIR = path.resolve(__dirname);

function run(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_DIR, encoding: 'utf8', timeout: 30000 }).trim();
  } catch (e) {
    return 'ERR: ' + (e.stderr || e.message);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/push' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const status = [];
      status.push('ADD: ' + run('git add "产品开发进度_管理工具.html"'));
      const diff = run('git diff --cached --stat');
      if (diff.includes('ERR') || !diff) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, msg: '没有需要推送的改动' }));
        return;
      }
      status.push('COMMIT: ' + run('git commit -m "auto-sync: ' + new Date().toLocaleString('zh-CN') + '"'));
      status.push('PUSH: ' + run('git push'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, msg: status.join('\n') }));
    });
    return;
  }

  if (req.url === '/status' && req.method === 'GET') {
    const s = run('git status --short');
    const remote = run('git remote -v');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: s, remote: remote, ready: !!remote }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Git sync server running on http://localhost:' + PORT);
  console.log('Push endpoint: POST http://localhost:' + PORT + '/push');
});
