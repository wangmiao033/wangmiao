# 个人日程（离线本地）

一个可直接使用的日历日程表：**月视图日历 + 每日待办 + 年度模板（每年复用）+ 经期预测/标记**。  
数据默认仅保存在本机浏览器（`localStorage`），支持导入/导出 JSON 做备份。

## 运行

```bash
cd planner
npm install
npm run dev
```

打开终端提示的本地地址（通常是 `http://localhost:5173/`）。

## 打包（用于部署 / PWA 安装）

```bash
npm run build
npm run preview
```

预览服务启动后，在手机浏览器打开同域名页面（或部署到 HTTPS 站点），即可“添加到主屏幕”当作 App 使用。

## 功能说明

- **日历（月视图）**：点某一天查看右侧详情
- **当日待办**：新增/勾选完成/删除；每个日期独立保存
- **年度模板**：在“设置 → 年度模板任务”里新增 `MM-DD + 内容`  
  - 例如 `03-08  送自己一束花`
  - 之后每年 `03-08` 都会自动出现
- **经期**
  - 日历配色：经期（粉红）、易孕期（绿色）、排卵日（蓝色，估算）
  - 在某一天点“标记：今天是来潮第一天”，后续会按周期参数预测
  - 在“设置 → 经期预测参数”里可调整：周期天数/经期天数/黄体期天数
- **数据导入/导出**
  - “设置 → 数据导入/导出”可导出 JSON
  - 导入会覆盖本地数据（建议先导出备份）

## 隐私

默认不联网、不上传；所有数据存在当前浏览器本地存储。  
如果你后续希望多端同步，我可以在不改变 UI 的前提下接入：WebDAV / iCloud/OneDrive 文件同步 / 自建后端。

## 云端账号与后台（Supabase）

本项目支持接入 Supabase（免费额度可起步），实现：
- 注册/登录
- 多设备云同步
- 管理后台（用户列表/统计/内容管理）

### 1) 建表与权限

在 Supabase 控制台的 SQL Editor 执行：
- `supabase/schema.sql`

### 2) 配置前端环境变量

复制 `.env.example` 为 `.env.local`，填入：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

然后重新启动开发服务器。

### 3) 部署（GitHub Pages）

仓库已包含 GitHub Actions 工作流：`.github/workflows/deploy-pages.yml`，会在你 push 到 `main` 后自动构建并发布 `planner/dist`。

你需要在 GitHub 仓库里做一次设置：
- Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**

然后在仓库的 Actions 里等待 `Deploy planner to GitHub Pages` 完成即可。

