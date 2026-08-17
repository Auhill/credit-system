// 封装所有后端 API 调用
const API = {
  _get: async (url) => {
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || '请求失败');
    return j;
  },
  _send: async (url, method, body) => {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || '请求失败');
    return j;
  },

  overview: () => API._get('/api/overview'),
  transactions: () => API._get('/api/transactions'),
  stats: () => API._get('/api/stats'),

  categories: {
    list: () => API._get('/api/categories'),
    create: (b) => API._send('/api/categories', 'POST', b),
    del: (id) => API._send('/api/categories/' + id, 'DELETE'),
  },

  tasks: {
    list: () => API._get('/api/tasks'),
    create: (b) => API._send('/api/tasks', 'POST', b),
    update: (id, b) => API._send('/api/tasks/' + id, 'PUT', b),
    del: (id) => API._send('/api/tasks/' + id, 'DELETE'),
    complete: (id) => API._send('/api/tasks/' + id + '/complete', 'POST'),
  },

  rewards: {
    list: () => API._get('/api/rewards'),
    create: (b) => API._send('/api/rewards', 'POST', b),
    del: (id) => API._send('/api/rewards/' + id, 'DELETE'),
    redeem: (id) => API._send('/api/rewards/' + id + '/redeem', 'POST'),
  },
};
