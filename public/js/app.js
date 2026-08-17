const routes = {
  '#/dashboard': renderDashboard,
  '#/tasks': renderTasks,
  '#/rewards': renderRewards,
  '#/history': renderHistory,
};

function setActiveNav(hash) {
  document.querySelectorAll('.nav-item').forEach((n) => {
    n.classList.toggle('active', n.dataset.route === hash);
  });
}

function renderLogin(app) {
  app.innerHTML = `
    <div class="login-wrap">
      <div class="login-card card">
        <div class="brand" style="justify-content:center; padding-bottom:8px;">
          <span class="brand-logo">💎</span>
          <span class="brand-name">Credit</span>
        </div>
        <p class="login-sub">请输入登录验证码以继续使用</p>
        <div class="field" style="margin-top:8px;">
          <label>验证码</label>
          <input class="input" id="login-code" type="password" placeholder="Access Code" autocomplete="off" />
        </div>
        <button class="btn btn-primary" id="login-btn" style="width:100%; margin-top:16px;">进入</button>
      </div>
    </div>
  `;
  const input = document.getElementById('login-code');
  const submit = async () => {
    const code = input.value.trim();
    if (!code) { toast('请输入验证码', 'error'); return; }
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast(j.error || '验证码错误', 'error');
        return;
      }
      toast('验证成功', 'success');
      navigate();
    } catch (e) {
      toast('网络错误', 'error');
    }
  };
  document.getElementById('login-btn').onclick = submit;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  input.focus();
}

async function navigate() {
  const hash = location.hash || '#/dashboard';
  const view = routes[hash] || renderDashboard;
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">加载中…</div>';
  try {
    await Store.refresh();
    await view(app);
    setActiveNav(hash);
    const out = document.getElementById('logoutBtn');
    if (out) out.style.display = '';
  } catch (e) {
    if (e.message && (e.message.includes('未登录') || e.message.includes('UNAUTHENTICATED'))) {
      renderLogin(app);
    } else {
      app.innerHTML = `<div class="empty">加载失败：${esc(e.message)}</div>`;
    }
  }
}

// 退出登录
(function bindLogout() {
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'logoutBtn') {
      e.preventDefault();
      fetch('/api/logout', { method: 'POST' }).finally(() => {
        const app = document.getElementById('app');
        if (app) renderLogin(app);
        const out = document.getElementById('logoutBtn');
        if (out) out.style.display = 'none';
      });
    }
  });
})();

window.addEventListener('hashchange', navigate);
window.addEventListener('load', () => {
  if (!location.hash) location.hash = '#/dashboard';
  else navigate();
});
