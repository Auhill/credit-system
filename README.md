# 个人 Credit 系统

本地运行的任务奖励 / 消耗积分平台。完成任务赚取 Credit，用 Credit 兑换想做的事。
带登录验证码，可部署到公网（如 Vercel）防止他人随意使用。

## 运行（本地）

```bash
cd credit-system
npm install
node server.js          # 默认 http://localhost:3000
PORT=8080 node server.js   # 自定义端口
```

首次启动会根据 `seed.json` 生成 `data/data.json`（你的真实数据）。
想改默认分类 / 任务 / 奖励，编辑 `seed.json` 后删除 `data/data.json` 重启即可重新初始化。

## 登录验证码

公网部署时用于防止陌生人登录。默认验证码为 `lastdance`。

- 后端强制校验：所有 `/api/*`（除 `/api/login`）都必须携带登录后下发的 Cookie，否则返回 401。
- 前端在检测到未登录时会弹出验证码输入框。
- 可用环境变量覆盖（推荐部署时设置）：
  ```bash
  ACCESS_CODE=你的强验证码
  SESSION_SECRET=一段随机字符串   # 用于签发登录 Cookie
  ```

## 部署到 Vercel

项目已做 Vercel 兼容处理（`api/index.js` 作为 serverless 入口，`vercel.json` 已配置）。

```bash
npm i -g vercel
vercel login
vercel --prod
```

部署后在 Vercel 环境变量中添加 `ACCESS_CODE` 与 `SESSION_SECRET`。

> ⚠️ **数据持久化注意**：Vercel 是无状态 serverless 环境，本地用 `data/data.json` 存储，
> 在 Vercel 上会回退到 `/tmp`，**数据不保证持久化**（重启/扩容可能丢失）。
> 如需在 Vercel 上长久保存数据，请接入 Vercel KV / Postgres；
> 或改用 **Railway / Render / Fly.io** 等支持常驻进程 + 持久磁盘的平台（当前架构无需改动即可运行）。

## 功能

- **总览**：当前总 Credit、累计收支、近 14 天趋势图、最近流水
- **任务**：增删改任务、新增分类、标记完成（自动 +Credit）
- **奖励**：增删奖励项、余额足够时一键兑换（自动 −Credit）
- **历史**：收支构成饼图 + 全部流水记录

## 数据

- 存储文件：`data/data.json`（JSON，单人本地）
- 总 Credit = 所有流水（ledger）金额之和（earn 为正、spend 为负），单一真相来源

## 技术栈

Node.js + Express（后端，JSON 文件持久化） · 原生 HTML/CSS/JS（前端，无构建） · Chart.js（图表）
