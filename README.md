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

当前架构是常驻 Node 进程 + `data/data.json`，天然契合 Railway / Render。
关键：通过环境变量 `DATA_DIR` 把数据目录指向平台挂载的**持久磁盘**，数据就不会随重启丢失。

### 方式 A：Railway

1. 在 [railway.app](https://railway.app) 注册并新建 Project → **Deploy from GitHub repo**（先确保代码已 push 到 GitHub）。
2. 在 Project 里 **Add Volume**（如挂载到 `/data`）。
3. 设置环境变量：`DATA_DIR=/data`、`ACCESS_CODE=你的验证码`、`SESSION_SECRET=随机串`。
4. 部署完成，Railway 会自动 `npm install && npm start`。

配置已就绪：`railway.json`（构建/启动命令）。也可本地 CLI 部署：
```bash
npm i -g railway
railway login
railway link
railway up
```

### 方式 B：Render

1. 在 [render.com](https://render.com) 新建 **Web Service** → 关联 GitHub 仓库。
2. 配置：`Build Command = npm install`，`Start Command = npm start`。
3. 在 **Advanced** 里 **Add Disk**：名称随意，Mount Path 填 `/var/data`，大小 1 GB。
4. 设置环境变量：`DATA_DIR=/var/data`、`ACCESS_CODE=你的验证码`（其余见 `render.yaml` 已自动生成）。
5. 部署完成即可访问。

> ⚠️ **Render 磁盘注意**：持久磁盘需要 **Starter 及以上付费套餐**（免费版无磁盘，数据仍会随部署重置）。
> 若只用免费版，请改用 Railway，或自行外接对象存储。

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

- 存储文件：`data/data.json`（JSON，单人本地）
- 总 Credit = 所有流水（ledger）金额之和（earn 为正、spend 为负），单一真相来源

## 技术栈

Node.js + Express（后端，JSON 文件持久化） · 原生 HTML/CSS/JS（前端，无构建） · Chart.js（图表）
