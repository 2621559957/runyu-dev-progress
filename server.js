const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_FILE = path.join(__dirname, 'data.json');
const HTML_FILE = path.join(__dirname, '产品开发进度_管理工具.html');

// 初始化数据文件
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// 获取本机局域网IP
function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// MIME types
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function readJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeJSON(filePath, data) {
  const temp = filePath + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(temp, filePath); // 原子写入，避免读脏数据
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0]; // strip query params

  // ── API: 获取数据 ──
  if (url === '/api/data' && req.method === 'GET') {
    const data = readJSON(DATA_FILE);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      data: data,
      count: data.length,
      updatedAt: fs.statSync(DATA_FILE).mtime.toISOString()
    }));
    return;
  }

  // ── API: 保存数据 ──
  if (url === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (!Array.isArray(json)) {
          throw new Error('数据格式错误：应为数组');
        }
        writeJSON(DATA_FILE, json);
        const now = new Date().toISOString();
        console.log(`[${now}] 数据已更新 · ${json.length} 个产品`);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, updatedAt: now }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // ── 静态文件服务 ──
  let filePath;
  if (url === '/' || url === '/index.html') {
    filePath = HTML_FILE;
  } else {
    // 安全检查：防止目录遍历
    const safePath = path.normalize(url).replace(/^(\.\.[\/\\])+/, '');
    filePath = path.join(__dirname, safePath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': getMime(filePath) });
    res.end(content);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   🏭 产品开发进度 · 共享服务器        ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║   本机访问:  http://localhost:${PORT}    ║`);
  ips.forEach(ip => {
    const addr = `http://${ip}:${PORT}`;
    console.log(`║   局域网:    ${addr.padEnd(24)}║`);
  });
  console.log('╠══════════════════════════════════════╣');
  console.log('║   所有编辑自动同步 · 无需导入导出    ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('按 Ctrl+C 停止服务器');
});
