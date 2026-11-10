# 维护与部署

本手册供 linsto.org 的内容发布者和代码维护者使用。以下命令均在仓库根目录运行。系统分层见[架构说明](architecture.md)，面向读者的个人介绍见[README](../README.md)。

## 本地运行

使用 Node.js 24（版本见 `.nvmrc`）与 pnpm 12.18.0（`package.json` 的 `packageManager` 已锁定）。安装方式见 [pnpm 官方文档](https://pnpm.io/installation)。已有 pnpm 会按项目配置选择锁定版本；不要混用 npm 或 yarn。

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium webkit
pnpm run dev
```

访问终端显示的本地地址。开发模式可看草稿和未来内容，搜索标题与摘要。

`Ctrl+C` 停止当前终端的开发服务。开发服务与 `preview` 构建预览是两个独立进程；另行在后台启动的预览不会随当前终端一起退出。需要关闭本站已登记的开发和预览服务时，在仓库目录执行：

```sh
pnpm run stop
```

```sh
pnpm run check
pnpm run build
pnpm run preview
```

生产预览才带 Pagefind 正文全文索引。生产构建自动排除草稿（未填写 `draft` 也视为草稿）和未来 `publishedAt`，检查重复地址、节目引用、章节时序、站内链接及资源。构建成功不会自动发布本地文件。

## 内容位置

| 内容     | 路径                                           | 正式地址               |
| -------- | ---------------------------------------------- | ---------------------- |
| 文字     | `content/writing/YYYY-MM-DD-固定标识/index.md` | `/writing/固定标识/`   |
| 声音     | `content/audio/固定标识/index.md`              | `/audio/固定标识/`     |
| 节目     | `content/series/节目标识.json`                 | 声音页分类             |
| 此刻     | `content/now/YYYY-MM.md`                       | `/now/YYYY/MM/`        |
| 关于     | `content/pages/about.md`                       | `/about/`              |
| 站点资料 | `content/settings/site.json`                   | 全站                   |
| 经典摘句 | `content/quotes/collection.json`               | 页脚上方，每次刷新随机 |

文字与声音页的副标题分别填写在 `content/settings/site.json` 的 `writingSubtitle` 和 `audioSubtitle`，留空即可隐藏。关于页可直接在 `content/pages/about.md` 的信息区下方写 Markdown 正文。

首页绘画由 `homeImage` 指定，关于页配图由 `content/pages/about.md` 的 `image` 指定，当前共用 `public/images/ridgelines.webp`。两页根据各自的显示宽度选择优化图片，并复用同一组缓存资源。替换原图后正常构建即可：本地 PNG、JPEG、WebP、AVIF 会自动生成多尺寸 AVIF/WebP 和内联预览，资源地址随内容更新，无需手工维护不同尺寸或修改缓存版本。外部图片地址按原样使用。

固定地址与标题分离，改标题不会改链接。时间必须填写**带引号、带时区**的 ISO 字符串，例如 `2026-11-09T18:30:00+08:00`。分类按内容自动生成，前台不需要修改代码。正文使用标准 Markdown。文章可在信息区添加 `videos` 与 `appendix`，字段定义见 `src/lib/schemas.ts`。

## 写一篇文章

```sh
pnpm run new writing my-essay --title "文章标题" --category "随笔"
```

目录按 `YYYY-MM-DD-slug` 命名，日期以 `publishedAt` 换算的北京时间为准。新草稿使用创建当天的日期。首次发布确定日期后，工具会连同配图一起调整目录，并输出新路径。

用 VS Code 打开生成的 Markdown 文件，编辑标题、摘要和正文。`slug` 是固定地址，`description` 是首页及列表显示的一句话。文章详情直接从 Markdown 正文开始。要为文字页最新文章的「文中一段」指定摘录，在信息区填写 `featuredExcerpt`；留空时由站点自动选取。

Markdown 图片可以带说明：

```md
![图片替代文字](/images/photo.webp '图片下方的说明。')
```

配图也可以和文章放在同一目录，用 `![说明](./photo.jpg "图片说明")` 引用；Astro 会生成带尺寸的优化图片，仍可点击放大。`public/images/` 适合保持原文件的公共图片。大媒体建议用下述 R2 上传工具。`pnpm run dev` 可预览草稿。准备好后：

```sh
pnpm run publish:content writing/2026-11-10-my-essay/index.md
pnpm run check
pnpm run build
```

`publish:content` 只更改本地内容，不会提交、推送。草稿首次发布时设为当前北京时间；已经发布的文章保留首次发布日期，更新 `updatedAt`。显式用 `--date` 修正发布日期时，文章目录也会同步调整。相对配图随整目录移动，文章 URL 和 `relatedWriting` 使用独立的 `slug`。发布前按与构建相同的规则校验元数据，校验失败保持原文件不变，成功时原子替换信息区并保留正文原始空白。同一篇文章的目录移动和元数据写回由工具协调，目标目录占用时拒绝覆盖。文章新建和发布通过集合内的 `.authoring.lock` 串行写入；异常退出后如提示锁仍存在，先确认相关命令已结束，再删除该锁文件重试。可以用 `--date "2026-11-10T09:00:00+08:00"` 指定时间。未来内容只会在该时间之后的下一次构建上线，并非自动定时发布。

## 发布声音

「声音」包含具名栏目和独立录音。栏目单集关联 `content/series/` 中的资料，外部平台的收听地址填写在 `listen`；独立录音以「声音手记」展示，使用本站播放器。首页、归档和声音列表按发布时间展示单集或录音。空栏目隐藏。

### 外部平台上的栏目

「老大不小」的标识为 `thirty-plus`。单集固定地址使用 `thirty-plus-ep期号`（如 `thirty-plus-ep32`），并在 `episode` 中填写原期号。部分历史导入同样沿用原期号。在小宇宙发布后，复制单集的网页地址，新建一份本站笔记：

```sh
pnpm run new audio episode-one --title "第一期" --description "这一期聊什么" --series thirty-plus --platform "小宇宙" --listen-url "https://www.xiaoyuzhoufm.com/episode/单集标识" --episode 1
```

工具创建草稿。可在生成的 Markdown 中填写单集笔记、文字稿和 `relatedWriting`，再发布：

```sh
pnpm run publish:content audio/episode-one/index.md
```

`listen` 是平台名称与单集 URL 的列表，可添加其他平台地址。详情页展示相应的收听按钮，音频仍由平台提供。`duration` 按秒填写，外部单集可省略。节目本身的订阅链接填写在 `content/series/thirty-plus.json` 的 `listen` 中。

开设另一档栏目，先运行 `pnpm run new series my-show --title "栏目名称" --description "一句介绍"`，再在单集命令里使用 `--series my-show`。栏目名和封面在节目 JSON 内维护。现有的 `kind: podcast` 表示栏目单集。

### 声音手记

首次配置 R2：创建存储桶，为其绑定 HTTPS 公共域名（如 `media.linsto.org`），创建该桶的 R2 API 密钥。在本地 `.env` 中填写 `.env.example` 对应的 R2 配置。

```sh
pnpm run audio --file "/path/to/voice.m4a" --slug autumn --title "秋日手记" --description "一句话介绍"
```

工具默认创建 `kind: recording`，省略 `--series`。它读取音频时长、大小和类型，以文件内容哈希生成 R2 地址。上传完成后生成本地草稿，已有文件会被保留。先用 `--dry-run` 可查看元数据，再编辑文字稿与章节，最后发布：

```sh
pnpm run publish:content audio/autumn/index.md
```

站内播放器需要音频地址、时长、字节数和 MIME 类型。首条录音公开后，「声音手记」入口出现。栏目若使用自托管音频，上传时追加 `--kind podcast --series thirty-plus`。

`uid` 为声音的稳定标识。站内声音 RSS 只收录有完整音频文件信息的条目，外部单集从对应平台订阅。首次上传后检查浏览器播放、拖动和章节跳转，构建只检查元数据与站内文件。远程音频的可访问性需要实际播放验证，格式优先使用 MP3 或 M4A。

图片或附件：

```sh
pnpm run media --file "/path/to/photo.webp"
```

成功时返回 Markdown 图片语法或文件链接。相同内容使用相同对象地址；删除文章不会自动删除 R2 文件，避免历史链接失效。若上传成功、随后写入草稿失败，检查 R2 后复用返回地址，或用同一文件重试；哈希地址可避免生成多份对象。

## 更新此刻

```sh
pnpm run new now --period 2026-11 --title "十一月，慢一点"
```

编辑 `notes` 中的小标题和段落，发布 `now/2026-11.md`。保留过去月份文件；`/now/` 自动显示最新月份，每月都有永久地址。不要用新月份内容覆盖旧文件。

## Cloudflare Pages 自动部署

采用 **Direct Upload + GitHub Actions**，不依赖 Cloudflare 的 Git 构建。请勿为同一个项目同时配置另一条 Git 自动构建，避免重复部署。旧 GitHub Pages 工作流已移除。

1. 在 Cloudflare 创建 Pages **Direct Upload** 项目（例如 `linsto`），生产分支设为 `main`。也可用 Wrangler `pages project create linsto --production-branch main` 创建。
2. GitHub 仓库 Settings → Secrets and variables → Actions，添加 Secrets：`CLOUDFLARE_API_TOKEN`（有该账户 Pages 编辑权限）、`CLOUDFLARE_ACCOUNT_ID`；添加 Variable：`CLOUDFLARE_PAGES_PROJECT=linsto`。
3. 推送当前功能分支：Actions 检查并构建，发布到 Cloudflare 的分支预览地址。推送或合并到 `main` 才更新生产站。拉取请求只检查构建，不使用部署密钥。
4. 确认 Pages 生产部署可用，在项目 Custom domains 添加 `www.linsto.org`。在权威 DNS 中设置 CNAME，名称为 `www`，目标为 `linsto.pages.dev`。等域名显示 Active，验证 HTTPS 访问。
5. 根域 `linsto.org` 使用 Cloudflare 代理。若 DNS 仍托管在其他服务商，先导入并核对原有记录，再在注册商更新 nameservers。为根域配置 Single Redirect，条件为 `http.host eq "linsto.org"`，动态目标为 `concat("https://www.linsto.org", http.request.uri.path)`，使用 301 并保留查询参数。确认根域 HTTPS 跳转正常后，在 GitHub Settings → Pages 关闭旧站发布。代码库的 `CNAME` 和 Hugo 发布流程已删除，旧站在 GitHub 的账户级设置不会由本地代码自动关闭。

缺少上述配置时，Actions 仍构建并保留下载产物，会明确提示部署未启用。站点域名、作者与品牌文案统一在 `content/settings/site.json` 维护；如需换域名，修改其中的 `url`。构建环境的 `SITE_URL` 可显式覆盖 canonical、站点地图与 RSS 的目标地址。预览站同样指向正式 canonical，避免替代正式域名。

R2 密钥仅用于作者本地上传，**不需要放入前端或部署工作流**。Pages 部署密钥和 R2 上传密钥应分开维护。

## 持续校验

```sh
pnpm run validate
```

依次执行代码格式检查、Node 内置测试、Astro 类型检查、完整构建和桌面/手机浏览器测试（包含 iPhone 尺寸的 WebKit）。`pnpm run validate:static` 执行前四项，无需安装浏览器。浏览器测试单独运行 `pnpm run test:browser`，会自动构建隔离的测试站并在结束后删除，不改动作者内容或正式 `dist/`。`content/` 下的作者内容不设代码格式门槛，保留 Markdown 原始排版，内容结构由共享 schema 校验。

CI 每次运行 `validate:static`，仅修改 `content/`、`docs/`、`README.md` 或 `CLAUDE.md` 时跳过浏览器安装与交互测试。其余路径变更（包括页面、样式、脚本、公共图片、依赖和工作流）、新分支首次推送、无法读取比较基准，以及手动运行 Actions，都会保留全部浏览器检查；检查通过后才部署。CI 的 Chromium 只安装无界面测试需要的 headless shell，WebKit 仍覆盖 iPhone。操作系统依赖仅在需要浏览器检查时安装。

CI 使用冻结锁文件；部署工具 Wrangler 也由该锁文件固定。依赖安装只允许明确列出的构建脚本，并要求新版本至少发布一天。

测试覆盖草稿与定时内容边界、重复文字/声音地址、内容引用、录音与节目分类、章节时序、发布日期保留、正文空白、无覆盖新建、失败不写入及相对链接/锚点检查。浏览器测试覆盖脚本延迟期间的搜索编辑、栏目检索范围、筛选后的布局与键盘焦点，以及中文正文在不同宽度下的换行。内容模型与部署边界见[架构说明](architecture.md)。

## 运行边界

当前站点提供静态展示与本地内容发布工具，尚未提供网页编辑后台、登录、多作者、评论和服务端接口。真实音频播放、R2 上传与线上自动部署的端到端验证需要配置相应的 Cloudflare 服务及凭据。

技术参考：[Astro 内容集合](https://docs.astro.build/en/guides/content-collections/)、[Pagefind 正文索引](https://pagefind.app/docs/indexing/)、[Cloudflare 持续集成上传](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)。
