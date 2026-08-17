function taskFormHTML() {
  const cats = Store.data.categories;
  const opts = cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  return `
  <div class="card" style="margin-bottom:18px;">
    <div class="section-title">➕ 新增任务</div>
    <div class="form-row">
      <div class="field" style="flex:2; min-width:200px;">
        <label>任务标题</label>
        <input class="input" id="t-title" placeholder="例如：完成杂事1" />
      </div>
      <div class="field">
        <label>分类</label>
        <select class="select" id="t-cat">${opts}<option value="">未分类</option></select>
      </div>
      <div class="field" style="max-width:140px;">
        <label>奖励 Credit</label>
        <input class="input" id="t-credit" type="number" min="0" value="0" />
      </div>
      <div class="field" style="max-width:120px;">
        <label>&nbsp;</label>
        <button class="btn btn-primary" id="t-add">添加</button>
      </div>
    </div>
  </div>`;
}

function categoryFormHTML() {
  const colors = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
  return `
  <div class="card" style="margin-bottom:18px;">
    <div class="section-title">🏷️ 新增分类</div>
    <div class="form-row">
      <div class="field" style="flex:2; min-width:200px;">
        <label>分类名称</label>
        <input class="input" id="c-name" placeholder="例如：理财" />
      </div>
      <div class="field" style="flex:2;">
        <label>颜色</label>
        <div class="color-row" id="c-colors">
          ${colors.map((c, i) => `<span class="color-swatch${i === 0 ? ' selected' : ''}" data-color="${c}" style="background:${c}"></span>`).join('')}
        </div>
      </div>
      <div class="field" style="max-width:120px;">
        <label>&nbsp;</label>
        <button class="btn btn-primary" id="c-add">添加分类</button>
      </div>
    </div>
  </div>`;
}

function taskItemHTML(t) {
  const done = t.status === 'completed';
  const color = Store.catColor(t.categoryId);
  return `<div class="task-item ${done ? 'done' : ''}">
    <div class="task-main">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">
        <span class="tag" style="background:${color}1a;color:${color}">${esc(Store.catName(t.categoryId))}</span>
        ${done ? `<span style="color:var(--green)">已完成</span>` : ''}
      </div>
    </div>
    <span class="credit-badge">+${t.credit} Credit</span>
    <div class="task-actions">
      ${done ? '' : `<button class="btn btn-success btn-sm" data-act="complete" data-id="${t.id}">完成</button>`}
      <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${t.id}">编辑</button>
      <button class="btn btn-ghost btn-sm btn-danger" data-act="del" data-id="${t.id}">删除</button>
    </div>
  </div>`;
}

function openEditTask(app, id) {
  const t = Store.data.tasks.find((x) => x.id === id);
  if (!t) return;
  const cats = Store.data.categories;
  const opts =
    cats.map((c) => `<option value="${c.id}" ${c.id === t.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('') +
    `<option value="" ${!t.categoryId ? 'selected' : ''}>未分类</option>`;
  openModal(`
    <h3>编辑任务</h3>
    <div class="field" style="margin-bottom:12px;">
      <label>标题</label>
      <input class="input" id="e-title" value="${esc(t.title)}" />
    </div>
    <div class="form-row">
      <div class="field">
        <label>分类</label>
        <select class="select" id="e-cat">${opts}</select>
      </div>
      <div class="field">
        <label>奖励 Credit</label>
        <input class="input" id="e-credit" type="number" min="0" value="${t.credit}" />
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" data-close>取消</button>
      <button class="btn btn-primary" id="e-save">保存</button>
    </div>
  `);
  document.getElementById('e-save').onclick = async () => {
    const title = document.getElementById('e-title').value.trim();
    const categoryId = document.getElementById('e-cat').value;
    const credit = document.getElementById('e-credit').value;
    if (!title) { toast('标题不能为空', 'error'); return; }
    try {
      await API.tasks.update(id, { title, categoryId: categoryId ? Number(categoryId) : null, credit: Number(credit) || 0 });
      closeModal();
      toast('已保存', 'success');
      await Store.refresh();
      renderTasks(app);
    } catch (e) { toast(e.message, 'error'); }
  };
}

function bindTaskActions(app) {
  app.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;
      if (act === 'complete') {
        try {
          await API.tasks.complete(id);
          toast('🎉 获得 Credit！', 'success');
          await Store.refresh();
          renderTasks(app);
        } catch (e) { toast(e.message, 'error'); }
      } else if (act === 'del') {
        if (!confirm('确定删除该任务？')) return;
        try {
          await API.tasks.del(id);
          await Store.refresh();
          renderTasks(app);
        } catch (e) { toast(e.message, 'error'); }
      } else if (act === 'edit') {
        openEditTask(app, id);
      }
    };
  });
}

async function renderTasks(app) {
  const d = Store.data;
  app.innerHTML = `
    <div class="page-header">
      <h1>任务</h1>
      <p>记录要做的事，完成后自动获得 Credit 奖励</p>
    </div>
    ${taskFormHTML()}
    ${categoryFormHTML()}
    <div id="taskGroups"></div>
  `;

  document.getElementById('t-add').onclick = async () => {
    const title = document.getElementById('t-title').value.trim();
    const categoryId = document.getElementById('t-cat').value;
    const credit = document.getElementById('t-credit').value;
    if (!title) { toast('请填写任务标题', 'error'); return; }
    try {
      await API.tasks.create({ title, categoryId: categoryId ? Number(categoryId) : null, credit: Number(credit) || 0 });
      toast('任务已添加', 'success');
      await Store.refresh();
      renderTasks(app);
    } catch (e) { toast(e.message, 'error'); }
  };

  let selColor = '#6366F1';
  document.querySelectorAll('#c-colors .color-swatch').forEach((sw) => {
    sw.onclick = () => {
      document.querySelectorAll('#c-colors .color-swatch').forEach((x) => x.classList.remove('selected'));
      sw.classList.add('selected');
      selColor = sw.dataset.color;
    };
  });
  document.getElementById('c-add').onclick = async () => {
    const name = document.getElementById('c-name').value.trim();
    if (!name) { toast('请填写分类名称', 'error'); return; }
    try {
      await API.categories.create({ name, color: selColor });
      toast('分类已添加', 'success');
      await Store.refresh();
      renderTasks(app);
    } catch (e) { toast(e.message, 'error'); }
  };

  const groups = document.getElementById('taskGroups');
  let html = '';
  const renderGroup = (name, color, tasks) => {
    if (!tasks.length) return '';
    return `<div class="section-title"><span class="cat-dot" style="background:${color}"></span>${esc(name)} <span style="color:var(--text-soft);font-weight:400;font-size:13px;">(${tasks.length})</span></div>` +
      tasks.map((t) => taskItemHTML(t)).join('');
  };
  d.categories.forEach((c) => {
    html += renderGroup(c.name, c.color, d.tasks.filter((t) => t.categoryId === c.id));
  });
  html += renderGroup('未分类', '#94a3b8', d.tasks.filter((t) => !t.categoryId));
  groups.innerHTML = html || '<div class="empty">还没有任务，先添加一个吧</div>';
  bindTaskActions(app);
}
