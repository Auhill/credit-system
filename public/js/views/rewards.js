function rewardFormHTML() {
  return `
  <div class="card" style="margin-bottom:18px;">
    <div class="section-title">➕ 新增奖励</div>
    <div class="form-row">
      <div class="field" style="max-width:80px;">
        <label>图标</label>
        <input class="input" id="r-icon" value="🎁" maxlength="2" />
      </div>
      <div class="field" style="flex:2; min-width:180px;">
        <label>名称</label>
        <input class="input" id="r-name" placeholder="例如：买杯奶茶" />
      </div>
      <div class="field" style="flex:2; min-width:180px;">
        <label>描述</label>
        <input class="input" id="r-desc" placeholder="可选" />
      </div>
      <div class="field" style="max-width:140px;">
        <label>花费 Credit</label>
        <input class="input" id="r-cost" type="number" min="0" value="0" />
      </div>
      <div class="field" style="max-width:120px;">
        <label>&nbsp;</label>
        <button class="btn btn-primary" id="r-add">添加</button>
      </div>
    </div>
  </div>`;
}

function rewardCardHTML(r, bal) {
  const afford = bal >= r.cost;
  return `<div class="reward-card ${afford ? 'affordable' : 'cant'}">
    <div class="reward-icon">${esc(r.icon)}</div>
    <div class="reward-name">${esc(r.name)}</div>
    <div class="reward-desc">${esc(r.desc)}</div>
    <div class="reward-cost">${r.cost.toLocaleString()} Credit</div>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-primary btn-sm" data-act="redeem" data-id="${r.id}" ${afford ? '' : 'disabled'} style="${afford ? '' : 'opacity:.5;cursor:not-allowed;'}">${afford ? '立即兑换' : '余额不足'}</button>
      <button class="btn btn-ghost btn-sm btn-danger" data-act="del" data-id="${r.id}">删除</button>
    </div>
  </div>`;
}

async function renderRewards(app) {
  const d = Store.data;
  const bal = d.overview.balance;
  app.innerHTML = `
    <div class="page-header">
      <h1>奖励</h1>
      <p>用攒下的 Credit 兑换你想做的事 · 当前余额 <b style="color:var(--primary)">${bal.toLocaleString()}</b></p>
    </div>
    ${rewardFormHTML()}
    <div class="reward-grid" id="rewardGrid"></div>
  `;

  const grid = document.getElementById('rewardGrid');
  grid.innerHTML = d.rewards.length
    ? d.rewards.map((r) => rewardCardHTML(r, bal)).join('')
    : '<div class="empty">还没有奖励项，先添加一个吧</div>';

  document.getElementById('r-add').onclick = async () => {
    const name = document.getElementById('r-name').value.trim();
    const desc = document.getElementById('r-desc').value.trim();
    const cost = document.getElementById('r-cost').value;
    const icon = document.getElementById('r-icon').value.trim() || '🎁';
    if (!name) { toast('请填写名称', 'error'); return; }
    try {
      await API.rewards.create({ name, desc, cost: Number(cost) || 0, icon });
      toast('奖励已添加', 'success');
      await Store.refresh();
      renderRewards(app);
    } catch (e) { toast(e.message, 'error'); }
  };

  grid.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;
      if (act === 'redeem') {
        try {
          await API.rewards.redeem(id);
          toast('🎉 兑换成功，好好享受！', 'success');
          await Store.refresh();
          renderRewards(app);
        } catch (e) { toast(e.message, 'error'); }
      } else if (act === 'del') {
        if (!confirm('确定删除该奖励？')) return;
        try {
          await API.rewards.del(id);
          await Store.refresh();
          renderRewards(app);
        } catch (e) { toast(e.message, 'error'); }
      }
    };
  });
}
