const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SEED_FILE = path.join(ROOT, 'seed.json');

// ---- 登录验证码（公网防护）----
// 默认 "lastdance"，可用环境变量 ACCESS_CODE 覆盖
const ACCESS_CODE = process.env.ACCESS_CODE || 'lastdance';
const SESSION_SECRET = process.env.SESSION_SECRET || 'credit-default-secret';

// ---- 存储层：优先 Postgres（DATABASE_URL），否则回退本地 JSON 文件 ----
const DATABASE_URL = process.env.DATABASE_URL || null;
let pool = null;
if (DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
  });
}

// 内存工作副本，所有请求直接读写它；持久化由 persist() 负责
let DATA = null;

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
function nowISO() {
  return new Date().toISOString();
}

// ---- 种子数据：从 seed.json 生成初始结构 ----
function loadSeedFile() {
  if (fs.existsSync(SEED_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}
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

// ---- 持久化 ----
async function persist() {
  if (pool) {
    await pool.query('UPDATE state SET data = $1 WHERE id = 1', [DATA]);
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(DATA, null, 2));
  }
}

function loadDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(buildSeed(loadSeedFile()), null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

let storeReady = null;
function ensureStore() {
  if (!storeReady) storeReady = initStore();
  return storeReady;
}
async function initStore() {
  if (pool) {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS state (id INT PRIMARY KEY, data JSONB NOT NULL)'
    );
    const res = await pool.query('SELECT data FROM state WHERE id = 1');
    if (res.rows.length) {
      DATA = res.rows[0].data;
    } else {
      const seeded = buildSeed(loadSeedFile());
      await pool.query('INSERT INTO state (id, data) VALUES (1, $1)', [seeded]);
      DATA = seeded;
    }
    return;
  }
  DATA = loadDataFile();
}

// ---- 业务辅助 ----
function balance(data) {
  return data.ledger.reduce((sum, e) => sum + (e.type === 'earn' ? e.amount : -e.amount), 0);
}
function nextId(arr) {
  return arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1;
}

// ---------------- 中间件 ----------------
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));

// 初始化存储（首次请求或启动时）
app.use(async (req, res, next) => {
  try {
    await ensureStore();
    next();
  } catch (e) {
    console.error('storage init failed:', e);
    res.status(500).json({ error: '存储初始化失败' });
  }
});

app.use((req, res, next) => {
  req.cookies = parseCookies(req);
  next();
});
app.use('/api', (req, res, next) => {
  if (req.path === '/login') return next();
  if (verifyToken(req.cookies.credit_auth)) return next();
  return res.status(401).json({ error: '未登录或验证码已失效', code: 'UNAUTHENTICATED' });
});

// ---------------- 认证 ----------------
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

// ---------------- API ----------------
app.get('/api/overview', (req, res) => {
  const d = DATA;
  const completed = d.tasks.filter((t) => t.status === 'completed').length;
  const pending = d.tasks.filter((t) => t.status === 'pending').length;
  const earn = d.ledger.filter((e) => e.type === 'earn').reduce((s, e) => s + e.amount, 0);
  const spend = d.ledger.filter((e) => e.type === 'spend').reduce((s, e) => s + e.amount, 0);
  res.json({
    balance: balance(d),
    completed,
    pending,
    earn,
    spend,
    taskCount: d.tasks.length,
  });
});

// 分类
app.get('/api/categories', (req, res) => res.json(DATA.categories));
app.post('/api/categories', async (req, res) => {
  const { name, color } = req.body || {};
  if (!name) return res.status(400).json({ error: '分类名称不能为空' });
  const cat = { id: nextId(DATA.categories), name, color: color || '#6366F1' };
  DATA.categories.push(cat);
  await persist();
  res.json(cat);
});
app.delete('/api/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (DATA.tasks.some((t) => t.categoryId === id)) {
    return res.status(400).json({ error: '该分类下还有任务，无法删除' });
  }
  DATA.categories = DATA.categories.filter((c) => c.id !== id);
  await persist();
  res.json({ ok: true });
});

// 任务
app.get('/api/tasks', (req, res) => res.json(DATA.tasks));
app.post('/api/tasks', async (req, res) => {
  const { title, categoryId, credit } = req.body || {};
  if (!title) return res.status(400).json({ error: '任务标题不能为空' });
  const task = {
    id: nextId(DATA.tasks),
    title,
    categoryId: categoryId || null,
    credit: Number(credit) || 0,
    status: 'pending',
    createdAt: nowISO(),
    completedAt: null,
  };
  DATA.tasks.push(task);
  await persist();
  res.json(task);
});
app.put('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const task = DATA.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  const { title, categoryId, credit } = req.body || {};
  if (title !== undefined) task.title = title;
  if (categoryId !== undefined) task.categoryId = categoryId || null;
  if (credit !== undefined) task.credit = Number(credit) || 0;
  await persist();
  res.json(task);
});
app.delete('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  DATA.tasks = DATA.tasks.filter((t) => t.id !== id);
  await persist();
  res.json({ ok: true });
});
app.post('/api/tasks/:id/complete', async (req, res) => {
  const id = Number(req.params.id);
  const task = DATA.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  if (task.status === 'completed') return res.status(400).json({ error: '任务已完成' });
  task.status = 'completed';
  task.completedAt = nowISO();
  DATA.ledger.push({
    id: nextId(DATA.ledger),
    type: 'earn',
    amount: task.credit,
    reason: '完成: ' + task.title,
    refId: task.id,
    createdAt: nowISO(),
  });
  await persist();
  res.json({ task, balance: balance(DATA) });
});

// 奖励
app.get('/api/rewards', (req, res) => res.json(DATA.rewards));
app.post('/api/rewards', async (req, res) => {
  const { name, desc, cost, icon } = req.body || {};
  if (!name) return res.status(400).json({ error: '奖励名称不能为空' });
  const r = { id: nextId(DATA.rewards), name, desc: desc || '', cost: Number(cost) || 0, icon: icon || '🎁' };
  DATA.rewards.push(r);
  await persist();
  res.json(r);
});
app.delete('/api/rewards/:id', async (req, res) => {
  const id = Number(req.params.id);
  DATA.rewards = DATA.rewards.filter((r) => r.id !== id);
  await persist();
  res.json({ ok: true });
});
app.post('/api/rewards/:id/redeem', async (req, res) => {
  const id = Number(req.params.id);
  const r = DATA.rewards.find((x) => x.id === id);
  if (!r) return res.status(404).json({ error: '奖励不存在' });
  const bal = balance(DATA);
  if (bal < r.cost) {
    return res.status(400).json({ error: 'Credit 不足', balance: bal, cost: r.cost });
  }
  DATA.ledger.push({
    id: nextId(DATA.ledger),
    type: 'spend',
    amount: r.cost,
    reason: '兑换: ' + r.name,
    refId: r.id,
    createdAt: nowISO(),
  });
  await persist();
  res.json({ reward: r, balance: balance(DATA) });
});

// 流水 & 统计
app.get('/api/transactions', (req, res) => {
  const sorted = [...DATA.ledger].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted);
});
app.get('/api/stats', (req, res) => {
  const days = 14;
  const map = {};
  DATA.ledger.forEach((e) => {
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

if (require.main === module) {
  ensureStore()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`个人 Credit 系统已启动: http://localhost:${PORT}`);
        console.log(`存储后端: ${pool ? 'Postgres (DATABASE_URL)' : '本地 JSON 文件'}`);
      });
    })
    .catch((err) => {
      console.error('启动失败:', err);
      process.exit(1);
    });
}

module.exports = app;
