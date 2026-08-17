// 前端全局状态：缓存后端数据，mutation 后刷新
const Store = {
  data: {
    overview: null,
    categories: [],
    tasks: [],
    rewards: [],
    transactions: [],
    stats: null,
  },

  async refresh() {
    const [overview, categories, tasks, rewards, transactions, stats] = await Promise.all([
      API.overview(),
      API.categories.list(),
      API.tasks.list(),
      API.rewards.list(),
      API.transactions(),
      API.stats(),
    ]);
    this.data = { overview, categories, tasks, rewards, transactions, stats };
    this._updateSidebar();
    return this.data;
  },

  _updateSidebar() {
    const el = document.getElementById('sidebarBalance');
    if (el) el.textContent = (this.data.overview?.balance ?? 0).toLocaleString();
  },

  catName(id) {
    const c = this.data.categories.find((c) => c.id === id);
    return c ? c.name : '未分类';
  },
  catColor(id) {
    const c = this.data.categories.find((c) => c.id === id);
    return c ? c.color : '#94a3b8';
  },
};

// 全局工具：toast 提示
function toast(msg, type = 'info') {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

// 转义用户输入，避免 HTML 注入
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 轻量模态框
function openModal(innerHTML) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `<div class="modal">${innerHTML}</div>`;
  mask.addEventListener('click', (e) => {
    if (e.target === mask || e.target.hasAttribute('data-close')) closeModal();
  });
  document.body.appendChild(mask);
  return mask;
}
function closeModal() {
  const m = document.querySelector('.modal-mask');
  if (m) m.remove();
}

// 流水行渲染（总览与历史共用）
function txnRow(t) {
  const earn = t.type === 'earn';
  return `<div class="txn-item">
    <div class="txn-icon ${earn ? 'earn' : 'spend'}">${earn ? '⬆️' : '⬇️'}</div>
    <div class="txn-main">
      <div class="txn-reason">${esc(t.reason)}</div>
      <div class="txn-date">${fmtDate(t.createdAt)}</div>
    </div>
    <div class="txn-amount ${earn ? 'earn' : 'spend'}">${earn ? '+' : '-'}${t.amount.toLocaleString()}</div>
  </div>`;
}

// 图表实例管理：同一 canvas 重绘前先销毁
const ChartBox = {
  instances: {},
  draw(canvasId, config) {
    if (this.instances[canvasId]) this.instances[canvasId].destroy();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    this.instances[canvasId] = new Chart(ctx, config);
  },
};
