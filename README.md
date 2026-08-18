# 个人 Credit 系统

本地运行的任务奖励 / 消耗积分平台。完成任务赚取 Credit，用 Credit 兑换想做的事。
带登录验证码，可部署到公网防止他人随意使用。推荐部署到 **Railway / Render** 等支持持久磁盘的平台，数据可长期保存。

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

## 部署（Railway / Render，数据可持久化）

后端存储层支持两种后端（由环境变量自动切换）：
- **Postgres（推荐，线上）**：设置 `DATABASE_URL` 后，数据落入 Postgres 的 `state` 表（JSONB），彻底持久化、不怕重启。
- **本地 JSON 文件（默认，本地）**：未设置 `DATABASE_URL` 时，使用 `data/data.json`，适合本地开发。

### 方式 A：Railway（推荐，Postgres 持久化）

Railway 自带 Postgres 插件，部署时一键挂载托管数据库，数据落到云端、永久保存。

```bash
# 1. 登录（浏览器授权）
railway login
# 2. 新建项目并关联当前目录
railway init --name credit-system
# 3. 添加 Postgres 插件（自动注入 DATABASE_URL 环境变量）
railway add -d postgres
# 4. 设置登录验证码等环境变量
railway variable set ACCESS_CODE=你的强验证码 SESSION_SECRET=一段随机串
# 5. 部署
railway up -y
```

配置已就绪：`railway.json`（构建/启动命令）。首次启动会自动建表并按 `seed.json` 初始化。

> 注：Railway 的 Postgres 插件按用量计费；免费试用额度可跑起来，长期稳定请绑卡。
> 若不想用 Railway 的数据库，也可把 `DATABASE_URL` 指向任意外部 Postgres（如 Neon / Supabase 免费库）。

### 方式 B：Render

1. 在 [render.com](https://render.com) 新建 **Web Service** → 关联 GitHub 仓库。
2. 配置：`Build Command = npm install`，`Start Command = npm start`。
3. 在 **Advanced** 里添加环境变量：`DATABASE_URL`（指向你的 Postgres，如 Supabase 免费库）、`ACCESS_CODE`、`SESSION_SECRET`。
4. 部署完成即可访问。

> 没有 Postgres 也可只用本地 JSON：但 Render 免费版文件系统是临时的，**数据会随部署重置**，仅适合演示。

### （可选）部署到 Vercel

项目已做 Vercel 兼容（`api/index.js` serverless 入口 + `vercel.json`）。但 Vercel 是无状态环境，
`data/data.json` 会回退到 `/tmp`，**数据不保证持久化**。仅在「临时演示、不关心数据」时使用：

```bash
npm i -g vercel && vercel login && vercel --prod
```

部署后在 Vercel 环境变量中添加 `ACCESS_CODE` 与 `SESSION_SECRET`。

## 功能

- **总览**：当前总 Credit、累计收支、近 14 天趋势图、最近流水
- **任务**：增删改任务、新增分类、标记完成（自动 +Credit）
- **奖励**：增删奖励项、余额足够时一键兑换（自动 −Credit）
- **历史**：收支构成饼图 + 全部流水记录

## 数据

- **线上（Postgres）**：数据存于 `DATABASE_URL` 指向的数据库 `state` 表（单行长 JSONB），首次启动自动建表并按 `seed.json` 初始化。
- **本地（JSON）**：未设置 `DATABASE_URL` 时使用 `data/data.json`。
- 总 Credit = 所有流水（ledger）金额之和（earn 为正、spend 为负），单一真相来源。

## 技术栈

Node.js + Express（后端，Postgres / JSON 双存储） · 原生 HTML/CSS/JS（前端，无构建） · Chart.js（图表） · `pg` 驱动
