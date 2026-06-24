const http = require('http');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3333;
// 使用 Windows 反斜杠路径，确保 spawnSync cwd 参数在所有环境下都能正确识别
const REPO_DIR = __dirname.replace(/\//g, '\\');

// Windows PortableGit 绝对路径（spawnSync 不走 shell，必须用反斜杠）
const GIT_EXE = 'C:\\Users\\admin\\.workbuddy\\vendor\\PortableGit\\mingw64\\bin\\git.exe';

function runGit(args) {
  const result = spawnSync(GIT_EXE, args, {
    cwd: REPO_DIR,
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  });
  if (result.error) {
    return { ok: false, msg: 'spawn error: ' + result.error.message };
  }
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  if (result.status !== 0) {
    return { ok: false, msg: stderr || stdout || ('exit code ' + result.status) };
  }
  return { ok: true, msg: stdout || stderr };
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
    req.on('data', d => body += d.toString('utf8'));
    req.on('end', () => {
      const mainFile = path.join(REPO_DIR, '产品开发进度_管理工具.html');
      const idxFile = path.join(REPO_DIR, 'index.html');
      const status = [];

      // 1. 用 POST body 中的最新数据更新 EMBEDDED_DATA 和 EMBEDDED_MEMBERS
      if (body && body.length > 10) {
        try {
          const payload = JSON.parse(body);
          const data = payload.products || payload;  // 兼容旧格式（纯数组）
          const members = payload.members || [];
          let html = fs.readFileSync(mainFile, 'utf8');
          let updated = false;
          // 更新产品数据（非空时才更新）
          if (Array.isArray(data) && data.length > 0) {
            const newEmbedded = 'const EMBEDDED_DATA = ' + JSON.stringify(data) + ';';
            html = html.replace(/const EMBEDDED_DATA\s*=\s*\[[\s\S]*?\];/, newEmbedded);
            status.push('DATA: 已更新EMBEDDED_DATA (' + data.length + '个产品)');
            updated = true;
          }
          // 更新组员列表（只要传了 members 字段就更新，允许清空）
          if (payload.members !== undefined) {
            const newMembers = 'const EMBEDDED_MEMBERS = ' + JSON.stringify(members) + ';';
            html = html.replace(/const EMBEDDED_MEMBERS\s*=\s*\[[\s\S]*?\];/, newMembers);
            status.push('DATA: 已更新EMBEDDED_MEMBERS (' + members.length + '个组员)');
            updated = true;
          }
          if (updated) {
            fs.writeFileSync(mainFile, html, 'utf8');
          }
        } catch(e) {
          status.push('DATA: 解析失败 - ' + e.message);
        }
      }

      // 2. 同步 index.html 给 GitHub Pages
      if (fs.existsSync(mainFile)) {
        fs.copyFileSync(mainFile, idxFile);
      }

      // 3. 清理可能残留的锁文件
      try { fs.unlinkSync(path.join(REPO_DIR, '.git', 'index.lock')); } catch(e) {}

      // 4. Git add（用相对文件名，cwd 已是正确的 REPO_DIR）
      const addRes = runGit(['add', '产品开发进度_管理工具.html', 'index.html']);
      if (!addRes.ok) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, msg: 'git add 失败：' + addRes.msg }));
        return;
      }
      status.push('ADD: ' + addRes.msg);

      // 5. Check diff
      const diffRes = runGit(['diff', '--cached', '--stat']);
      if (!diffRes.ok) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, msg: 'git diff 失败：' + diffRes.msg }));
        return;
      }
      if (!diffRes.msg) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, msg: '没有需要推送的改动' }));
        return;
      }

      // 6. Commit
      const commitRes = runGit(['commit', '-m', 'auto-sync: ' + new Date().toLocaleString('zh-CN')]);
      if (!commitRes.ok) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, msg: 'git commit 失败：' + commitRes.msg }));
        return;
      }
      status.push('COMMIT: ' + commitRes.msg);

      // 7. Push
      const pushRes = runGit(['push']);
      if (!pushRes.ok) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, msg: status.join('\n') + '\nPUSH FAILED: ' + pushRes.msg }));
        return;
      }
      status.push('PUSH: ' + pushRes.msg);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, msg: status.join('\n') }));
    });
    return;
  }

  if (req.url === '/status' && req.method === 'GET') {
    const s = runGit(['status', '--short']);
    const remote = runGit(['remote', '-v']);
    const gitOk = s.ok && remote.ok;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: s.msg, remote: remote.msg, ready: gitOk }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Git sync server running on http://localhost:' + PORT);
  console.log('Push endpoint: POST http://localhost:' + PORT + '/push');
});
