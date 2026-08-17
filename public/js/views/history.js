async function renderHistory(app) {
  const d = Store.data;
  app.innerHTML = `
    <div class="page-header">
      <h1>历史</h1>
      <p>每一次获得与消耗都记录在案</p>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="section-title">🍩 收支构成</div>
        <canvas id="catChart" height="140"></canvas>
      </div>
      <div class="card">
        <div class="section-title">🧾 全部流水</div>
        <div class="txn-list" id="allTxn"></div>
      </div>
    </div>
  `;

  ChartBox.draw('catChart', {
    type: 'doughnut',
    data: {
      labels: ['获得', '消耗'],
      datasets: [{ data: [d.overview.earn, d.overview.spend], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }],
    },
    options: { plugins: { legend: { position: 'bottom' } } },
  });

  const txn = d.transactions;
  document.getElementById('allTxn').innerHTML = txn.length
    ? txn.map(txnRow).join('')
    : '<div class="empty">暂无流水</div>';
}
