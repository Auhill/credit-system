async function renderDashboard(app) {
  const d = Store.data;
  const o = d.overview;
  app.innerHTML = `
    <div class="page-header">
      <h1>总览</h1>
      <p>你的 Credit 资产与近期收支一目了然</p>
    </div>
    <div class="grid grid-4">
      <div class="card balance-hero stat-card">
        <span class="label">当前总 Credit</span>
        <span class="value">${o.balance.toLocaleString()}</span>
      </div>
      <div class="card stat-card">
        <span class="label">累计获得</span>
        <span class="value green">+${o.earn.toLocaleString()}</span>
      </div>
      <div class="card stat-card">
        <span class="label">累计消耗</span>
        <span class="value red">-${o.spend.toLocaleString()}</span>
      </div>
      <div class="card stat-card">
        <span class="label">待办 / 已完成</span>
        <span class="value primary">${o.pending} / ${o.completed}</span>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <div class="section-title">📈 近 14 天收支趋势</div>
      <canvas id="trendChart" height="90"></canvas>
    </div>

    <div class="card" style="margin-top:18px;">
      <div class="section-title">🕑 最近流水</div>
      <div id="recentTxn"></div>
    </div>
  `;

  const s = d.stats;
  ChartBox.draw('trendChart', {
    type: 'line',
    data: {
      labels: s.labels,
      datasets: [
        { label: '获得', data: s.earn, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.12)', fill: true, tension: .35, pointRadius: 2 },
        { label: '消耗', data: s.spend, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.10)', fill: true, tension: .35, pointRadius: 2 },
      ],
    },
    options: { plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } },
  });

  const txn = d.transactions.slice(0, 6);
  document.getElementById('recentTxn').innerHTML = txn.length
    ? txn.map(txnRow).join('')
    : '<div class="empty">暂无流水，去完成任务赚取 Credit 吧</div>';
}
