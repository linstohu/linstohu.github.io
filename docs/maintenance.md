# 维护与部署

## 本地预览

在仓库根目录运行以下命令。Node.js 24 由 `.nvmrc` 指定，pnpm 12.18.0 由 `package.json` 的 `packageManager` 锁定。

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

开发预览包含草稿和未来内容，可搜索标题与摘要。要核对正式页面和 Pagefind 正文搜索，运行 `pnpm run build && pnpm run preview`。`pnpm run stop` 关闭本仓库已登记的开发和预览服务。

## 写作与发布

```sh
pnpm run new writing my-essay --title "文章标题" --category "随笔"
```

打开生成的 `index.md`，填写列表摘要 `description` 和正文。文字列表的「文中一段」默认从正文选取，也可用 `featuredExcerpt` 指定。

配图与文章放在同一目录，用 `![替代文字](./photo.jpg "图注")` 引用。公共图片放在 `public/images/`，用 `/images/文件名` 引用。

**发布命令接收相对于 `content/` 的路径。** 将下例的日期换成草稿目录中的日期。

```sh
pnpm run publish:content writing/2026-11-18-my-essay/index.md
```

- 首次发布设置 `draft: false`，将当前时间写入 `publishedAt`。再次发布沿用首次日期，文章同时更新 `updatedAt`。
- 指定时间可追加 `--date "2026-11-18T09:00:00+08:00"`。手填 YAML 时间时也用带引号和时区的 ISO 8601 字符串。文章目录按北京时间的发布日期命名，改到另一天时配图随目录移动。对外链接由 `slug` 决定。
- 本地发布后，提交改动并推送或合并到 `main`。生产构建只收录 `draft: false` 且 `publishedAt` 已到的内容。未来内容到期后，可在 Actions 对 `main` 手动运行 **Validate and deploy**。

若提示「内容写入正在进行」，等正在写入的操作结束后重试。若进程已异常退出，确认提示中的锁文件所属进程已结束，再删除该锁文件。

### AI 对话

```sh
pnpm run new prompted my-question --title "一个想弄明白的问题" --assistant "ChatGPT"
```

`prompted` 是文字分类，草稿正文留空。可以直接写 Markdown。需要左右对话排版时，让说话者标记独占一段。

```md
**我：**

我的问题。

**AI：**

AI 的回答。
```

追问时再写一段 `**我：**`。多轮对话按提问原文生成目录。AI 长回答按 Markdown 标题折叠。无标题的长清单、表格和代码也可单独展开。对话后另起一段写 `---`，即可继续写自己的笔记。`--assistant` 设置 AI 显示名，默认是「AI」。`--model` 和 `--conversation-url` 可记录模型与原对话链接。

### 此刻

```sh
pnpm run new now --period 2026-12 --title "十二月近况"
```

在文件正文写 Markdown，再运行 `pnpm run publish:content now/2026-12.md`。每月单独建档，`/now/` 显示最新公开月份。已有的 `notes` 会显示在正文前面，仍可继续使用。

## 声音与媒体

### 外部平台的播客单集

「老大不小」使用栏目 `thirty-plus`。单集 `slug` 和 `--episode` 沿用平台期号，`--listen-url` 填该集的网页地址。

```sh
pnpm run new audio thirty-plus-ep34 --series thirty-plus --episode 34 \
  --title "单集标题" --description "这一期聊什么" \
  --platform "小宇宙" --listen-url "https://www.xiaoyuzhoufm.com/episode/EPISODE_ID"
```

写完单集笔记后，运行 `pnpm run publish:content audio/thirty-plus-ep34/index.md`。需要关联文章时，在 `relatedWriting` 填文章的 `slug`。

节目订阅地址填在 `content/series/thirty-plus.json` 的 `listen` 中。新栏目用 `pnpm run new series my-show --title "栏目名称"` 创建。

### 自托管录音与附件（R2）

给 R2 桶绑定公共 HTTPS 域名，按模板填写本地 `.env`。[环境变量模板](../.env.example)

| 变量                                       | 用途                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| `R2_ACCOUNT_ID`、`R2_BUCKET`               | Cloudflare 账户 ID、桶名                                       |
| `R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY` | 该桶的写入凭据                                                 |
| `MEDIA_PUBLIC_URL`                         | 不含认证信息的公共 HTTPS 地址，例如 `https://media.linsto.org` |

```sh
pnpm run audio --file ./voice.m4a --slug autumn \
  --title "秋日手记" --description "一段秋天的录音"
```

命令默认创建独立录音，自托管播客单集追加 `--kind podcast --series thirty-plus`。草稿会写入播放器和声音 RSS 所需的 `src`、`bytes`、`mime` 和 `duration`（秒）。编辑单集时保留 RSS 标识 `uid`，在预览页检查播放、拖动和章节跳转。

图片或附件用 `pnpm run media --file ./photo.webp` 上传，复制输出的 Markdown 或 URL。`audio` 和 `media` 均支持 `--dry-run` 本地检查。WebM 按实际轨道确定 MIME，声音条目需要可用的音轨。工具从同一份临时副本读取元数据、计算哈希并上传，大文件需预留相应的临时空间。上传成功但写草稿失败时，用同一文件重试可复用 R2 地址。要撤下媒体文件，需单独处理 R2 对象。

## 内容文件速查

| 内容           | 相对于 `content/` 的路径           | 地址或字段                                                       |
| -------------- | ---------------------------------- | ---------------------------------------------------------------- |
| 文字与 AI 对话 | `writing/YYYY-MM-DD-slug/index.md` | `/writing/<slug>/`                                               |
| 声音           | `audio/slug/index.md`              | `/audio/<slug>/`                                                 |
| 节目           | `series/slug.json`                 | 栏目名称、封面、订阅链接                                         |
| 此刻           | `now/YYYY-MM.md`                   | `/now/YYYY/MM/`                                                  |
| 关于           | `pages/about.md`                   | `/about/` 的正文与 `image`                                       |
| 站点资料       | `settings/site.json`               | `url`、`author`、`homeImage`、`writingSubtitle`、`audioSubtitle` |
| 页脚摘句       | `quotes/collection.json`           | 引文、作者、作品、出处链接                                       |

文章的 `videos`、`appendix` 和其他可选字段见[内容模型](../src/lib/schemas.ts)。实现细节见[架构说明](architecture.md)。

## 校验与部署

| 本地命令                   | 检查范围                                              |
| -------------------------- | ----------------------------------------------------- |
| `pnpm run validate:static` | 格式、Node 测试、Astro 类型、生产构建及站内链接与资源 |
| `pnpm run test:browser`    | 桌面、Android 与 iPhone 尺寸的浏览器用例              |
| `pnpm run validate`        | 以上两组检查                                          |

首次运行浏览器用例前执行 `pnpm exec playwright install chromium webkit`。CI 每次运行静态校验。仅改 `content/`、`docs/`、`README.md` 或 `CLAUDE.md` 时跳过浏览器用例。手动运行或缺少比较基准时执行全部检查。

GitHub Actions 将校验后的 `dist/` 保存为 `website` 产物。配置好 Pages 后，`main` 分支部署到生产，其他分支推送生成预览，PR 只做校验。部署配置缺失时仍可下载 `website`。[工作流](../.github/workflows/site.yml)

### Cloudflare Pages 配置

1. 创建 **Direct Upload** 项目，生产分支设为 `main`。
2. 在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 添加 Secrets `CLOUDFLARE_ACCOUNT_ID` 和 `CLOUDFLARE_API_TOKEN`（该账户的 Pages 编辑权限）。在 Variables 添加 `CLOUDFLARE_PAGES_PROJECT`，值为 Pages 项目名。
3. 在 Pages 绑定自定义域名 `www.linsto.org`，将 `www` 的 CNAME 指向 `<项目名>.pages.dev`。
4. 为根域 `linsto.org` 启用 Cloudflare DNS 代理。设置 Single Redirect，条件为 `http.host eq "linsto.org"`，目标为 `concat("https://www.linsto.org", http.request.uri.path)`，状态码选 301，勾选保留查询参数。

换域名时同步更新 `content/settings/site.json` 的 `url`。构建环境的 `SITE_URL` 可覆盖 canonical、站点地图和 RSS 使用的基础地址。
