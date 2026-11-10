# linsto.org

Astro 静态个人网站，包含文字、声音、此刻及归档、关于页面。内容保存在 Git 中，GitHub Actions 构建后上传 Cloudflare Pages，音频和大媒体存放在 R2。Node.js 用于本地开发、内容工具和构建，线上提供静态文件。

## 代码入口

| 位置                                            | 职责                                                       |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `content/`                                      | Markdown 正文与元数据、节目、站点资料和经典摘句            |
| `src/content.config.ts`                         | Astro 内容集合及文件加载规则                               |
| `src/lib/schemas.ts`、`src/lib/publication.ts`  | 内容模型校验（CLI 与站点共用）、生产公开条件及内容引用关系 |
| `src/lib/content.ts`                            | 内容查询、排序、固定地址及日期格式                         |
| `src/pages/`、`src/layouts/`、`src/components/` | 路由、页面布局和共享组件                                   |
| `src/scripts/`、`src/styles/site.css`           | 按页面加载的浏览器交互与站点样式                           |
| `scripts/`                                      | 作者工具、媒体上传及构建产物检查                           |
| `tests/`                                        | Node 内置测试、真实 Astro 构建与浏览器交互测试             |

维护与部署操作见[维护手册](docs/maintenance.md)；系统分层和部署边界见[架构说明](docs/architecture.md)。

## 运行与验证

Node.js 版本以 `.nvmrc` 为准，pnpm 版本以 `package.json` 的 `packageManager` 为准。依赖及安装策略由 `pnpm-lock.yaml` 和 `pnpm-workspace.yaml` 维护。

首次安装使用 `pnpm install --frozen-lockfile`，随后运行 `pnpm exec playwright install chromium webkit` 安装测试浏览器。

| 命令                                 | 用途                                            |
| ------------------------------------ | ----------------------------------------------- |
| `pnpm run dev`                       | 编辑预览，包含草稿和未来内容；搜索标题与摘要    |
| `pnpm run build`、`pnpm run preview` | 生成并预览生产站，包含 Pagefind 正文索引        |
| `pnpm run validate`                  | 检查格式、Node 测试、类型、生产构建与浏览器交互 |
| `pnpm run validate:static`           | 检查格式、Node 测试、类型与生产构建，无需浏览器 |
| `pnpm run stop`                      | 关闭本站已登记的开发及构建预览服务              |

完成改动后运行 `pnpm run validate`。界面改动还需核对桌面与移动布局、明暗主题、键盘操作及涉及的交互。开发服务与构建预览是独立进程，后台启动的服务使用 `pnpm run stop` 关闭。

## 内容约定

- 文章目录为 `YYYY-MM-DD-slug`，日期按 `publishedAt` 的北京时间计算；文章和声音使用目录内的 `index.md`，此刻使用 `content/now/YYYY-MM.md`；模型定义集中在 `src/lib/schemas.ts`。
- 生产公开条件为 `draft: false` 且 `publishedAt` 不晚于构建时间；页面、订阅、站点地图与搜索索引沿用同一公开集合。未来内容在发布时间之后的下一次构建上线。
- 日期为带引号、带时区的 ISO 字符串，展示使用 `Asia/Shanghai`。`slug` 是文章和声音的固定地址标识，`uid` 是声音订阅标识，`period` 是月份快照标识；标题与这些标识分开维护。
- 声音包含栏目单集与声音手记，栏目由 `series` 关联，外部收听地址由 `listen` 提供，相关文字由 `relatedWriting` 显式关联。历史月份分别保存，`/now/` 展示最新公开快照。
- 发布工具默认保留已发布文章的 `publishedAt`、更新 `updatedAt`，校验成功后原子写回文件并保留正文空白。`content/` 不参与代码格式检查，结构由共享 schema 校验。
- 站点地址、作者与品牌资料在 `content/settings/site.json`；经典摘句在 `content/quotes/collection.json`。

## 渲染与部署

页面由 Astro 输出 HTML，浏览器脚本提供渐进增强。文章目录内的相对图片经 Astro 处理，`src/lib/rehype-figures.mjs` 在保留原生图片处理能力的基础上生成图注和放大入口。`public/` 内的文件按原样发布。

`pnpm run build` 生成静态页面和 Pagefind 索引，再检查站内链接、资源、锚点及订阅文件。完整搜索和公开内容检查使用生产构建预览。

部署流程在 `.github/workflows/site.yml`：每次运行静态校验；仅内容和文档变更跳过浏览器安装与测试，代码等其他变更、手动运行或缺少比较基准时执行完整浏览器检查。拉取请求运行校验；分支推送在配置齐全时上传同一份 `dist/`，`main` 对应 Cloudflare Pages 生产分支。

R2 上传工具读取本地 `.env`，Pages 部署读取 GitHub Secrets。可提交的环境变量模板为 `.env.example`；站点公共配置和环境变量用途见[维护手册](docs/maintenance.md)。
