const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const ROOT = __dirname;
const IS_VERCEL = !!process.env.VERCEL;
// Vercel 是无状态 serverless：本地用项目内 data/，部署环境回退到 /tmp（注意：/tmp 不保证持久化）
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SEED_FILE = path.join(ROOT, 'seed.json');

// ---- 登录验证码（公网防护）----
// 默认 "lastdance"，可用环境变量 ACCESS_CODE 覆盖
const ACCESS_CODE = process.env.ACCESS_CODE || 'lastdance';
const SESSION_SECRET = process.env.SESSION_SECRET || 'credit-default-secret';

function signToken() {
  const payload = Buffer.from(JSON.stringify({ t: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyToken(token) {
  if (!token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(parts[0]).digest('base64url');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[1]));
  } catch (e) {
    return false;
  }
}
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(';').forEach((c) => {
    const idx = c.indexOf('=');
    if (idx > -1) out[c.slice(0, idx).trim()] = decodeURIComponent(c.slice(idx + 1).trim());
  });
  return out;
}

app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));

// 解析 cookie + 校验登录态（/api/login 除外）
app.use((req, res, next) => {
  req.cookies = parseCookies(req);
  next();
});
app.use('/api', (req, res, next) => {
  if (req.path === '/login') return next();
  if (verifyToken(req.cookies.credit_auth)) return next();
  return res.status(401).json({ error: '未登录或验证码已失效', code: 'UNAUTHENTICATED' });
});

app.post('/api/login', (req, res) => {
  const { code } = req.body || {};
  if (!code || code !== ACCESS_CODE) {
    return res.status(401).json({ error: '验证码错误' });
  }
  res.cookie('credit_auth', signToken(), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('credit_auth');
  res.json({ ok: true });
});

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function nowISO() {
  return new Date().toISOString();
}

// 首次启动：从 seed.json 生成 data.json，并用最新时间补全日期字段
function buildSeed(seed) {
  const s = seed || {};
  const cats = (s.categories || []).map((c, i) => ({
    id: i + 1,
    name: c.name,
    color: c.color || '#6366F1',
  }));
  const catIdByName = {};
  cats.forEach((c) => (catIdByName[c.name] = c.id));

  const tasks = (s.tasks || []).map((t, i) => ({
    id: i + 1,
    title: t.title,
    categoryId: catIdByName[t.category] != null ? catIdByName[t.category] : null,
    credit: Number(t.credit) || 0,
    status: 'pending',
    createdAt: nowISO(),
    completedAt: null,
  }));

  const rewards = (s.rewards || []).map((r, i) => ({
    id: i + 1,
    name: r.name,
    desc: r.desc || '',
    cost: Number(r.cost) || 0,
    icon: r.icon || '🎁',
  }));

  const ledger = (s.ledger || []).map((l, i) => ({
    id: i + 1,
    type: l.type,
    amount: Number(l.amount) || 0,
    reason: l.reason || '',
    refId: null,
    createdAt: new Date(Date.now() - (Number(l.daysAgo) || 0) * 86400000).toISOString(),
  }));

  return { categories: cats, tasks, rewards, ledger };
}

function loadData() {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    let seed = null;
    if (fs.existsSync(SEED_FILE)) {
      try {
        seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
      } catch (e) {
        seed = null;
      }
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(buildSeed(seed), null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function saveData(data) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function balance(data) {
  return data.ledger.reduce((sum, e) => sum + (e.type === 'earn' ? e.amount : -e.amount), 0);
}

function nextId(arr) {
  return arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1;
}

// ---------------- API ----------------

app.get('/api/overview', (req, res) => {
  const data = loadData();
  const completed = data.tasks.filter((t) => t.status === 'completed').length;
  const pending = data.tasks.filter((t) => t.status === 'pending').length;
  const earn = data.ledger.filter((e) => e.type === 'earn').reduce((s, e) => s + e.amount, 0);
  const spend = data.ledger.filter((e) => e.type === 'spend').reduce((s, e) => s + e.amount, 0);
  res.json({
    balance: balance(data),
    completed,
    pending,
    earn,
    spend,
    taskCount: data.tasks.length,
  });
});

// 分类
app.get('/api/categories', (req, res) => res.json(loadData().categories));
app.post('/api/categories', (req, res) => {
  const data = loadData();
  const { name, color } = req.body || {};
  if (!name) return res.status(400).json({ error: '分类名称不能为空' });
  const cat = { id: nextId(data.categories), name, color: color || '#6366F1' };
  data.categories.push(cat);
  saveData(data);
  res.json(cat);
});
app.delete('/api/categories/:id', (req, res) => {
  const data = loadData();
  const id = Number(req.params.id);
  if (data.tasks.some((t) => t.categoryId === id)) {
    return res.status(400).json({ error: '该分类下还有任务，无法删除' });
  }
  data.categories = data.categories.filter((c) => c.id !== id);
  saveData(data);
  res.json({ ok: true });
});

// 任务
app.get('/api/tasks', (req, res) => res.json(loadData().tasks));
app.post('/api/tasks', (req, res) => {
  const data = loadData();
  const { title, categoryId, credit } = req.body || {};
  if (!title) return res.status(400).json({ error: '任务标题不能为空' });
  const task = {
    id: nextId(data.tasks),
    title,
    categoryId: categoryId || null,
    credit: Number(credit) || 0,
    status: 'pending',
    createdAt: nowISO(),
    completedAt: null,
  };
  data.tasks.push(task);
  saveData(data);
  res.json(task);
});
app.put('/api/tasks/:id', (req, res) => {
  const data = loadData();
  const id = Number(req.params.id);
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  const { title, categoryId, credit } = req.body || {};
  if (title !== undefined) task.title = title;
  if (categoryId !== undefined) task.categoryId = categoryId || null;
  if (credit !== undefined) task.credit = Number(credit) || 0;
  saveData(data);
  res.json(task);
});
app.delete('/api/tasks/:id', (req, res) => {
  const data = loadData();
  const id = Number(req.params.id);
  data.tasks = data.tasks.filter((t) => t.id !== id);
  saveData(data);
  res.json({ ok: true });
});
app.post('/api/tasks/:id/complete', (req, res) => {
  const data = loadData();
  const id = Number(req.params.id);
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  if (task.status === 'completed') return res.status(400).json({ error: '任务已完成' });
  task.status = 'completed';
  task.completedAt = nowISO();
  data.ledger.push({
    id: nextId(data.ledger),
    type: 'earn',
    amount: task.credit,
    reason: '完成: ' + task.title,
    refId: task.id,
    createdAt: nowISO(),
  });
  saveData(data);
  res.json({ task, balance: balance(data) });
});

// 奖励
app.get('/api/rewards', (req, res) => res.json(loadData().rewards));
app.post('/api/rewards', (req, res) => {
  const data = loadData();
  const { name, desc, cost, icon } = req.body || {};
  if (!name) return res.status(400).json({ error: '奖励名称不能为空' });
  const r = { id: nextId(data.rewards), name, desc: desc || '', cost: Number(cost) || 0, icon: icon || '🎁' };
  data.rewards.push(r);
  saveData(data);
  res.json(r);
});
app.delete('/api/rewards/:id', (req, res) => {
  const data = loadData();
  const id = Number(req.params.id);
  data.rewards = data.rewards.filter((r) => r.id !== id);
  saveData(data);
  res.json({ ok: true });
});
app.post('/api/rewards/:id/redeem', (req, res) => {
  const data = loadData();
  const id = Number(req.params.id);
  const r = data.rewards.find((x) => x.id === id);
  if (!r) return res.status(404).json({ error: '奖励不存在' });
  const bal = balance(data);
  if (bal < r.cost) {
    return res.status(400).json({ error: 'Credit 不足', balance: bal, cost: r.cost });
  }
  data.ledger.push({
    id: nextId(data.ledger),
    type: 'spend',
    amount: r.cost,
    reason: '兑换: ' + r.name,
    refId: r.id,
    createdAt: nowISO(),
  });
  saveData(data);
  res.json({ reward: r, balance: balance(data) });
});

// 流水 & 统计
app.get('/api/transactions', (req, res) => {
  const data = loadData();
  const sorted = [...data.ledger].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted);
});
app.get('/api/stats', (req, res) => {
  const data = loadData();
  const days = 14;
  const map = {};
  data.ledger.forEach((e) => {
    const d = new Date(e.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map[key]) map[key] = { earn: 0, spend: 0 };
    if (e.type === 'earn') map[key].earn += e.amount;
    else map[key].spend += e.amount;
  });
  const labels = [], earnArr = [], spendArr = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    labels.push(key.slice(5));
    earnArr.push(map[key] ? map[key].earn : 0);
    spendArr.push(map[key] ? map[key].spend : 0);
  }
  res.json({ labels, earn: earnArr, spend: spendArr });
});

const PORT = process.env.PORT || 3000;

// 本地直接运行才监听端口；被 Vercel 作为 serverless 函数引入时不监听
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`个人 Credit 系统已启动: http://localhost:${PORT}`);
  });
}

module.exports = app;
