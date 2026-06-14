# 项目说明

这是一个用 Hugo 构建的个人网站。核心内容是位于 `content/essays/` 下的中文随笔专栏。

## 文件与结构约定

- 每篇文章一个目录：`content/essays/<english-kebab-slug>/index.md`，slug 用英文短横线命名（如 `description-is-not-the-thing`）。
- Front matter 格式：
  ```yaml
  ---
  title: "中文标题"
  date: 2026-06-14T22:30:00+08:00
  lastmod: 2026-06-14T22:30:00+08:00
  ---
  ```
  date 用当前日期时间、`+08:00` 时区；新建文章时 `lastmod` 与 `date` 相同。
- 开头第一段（钩子段）之后，单独一行放 `<!--more-->` 作为摘要分隔符。
- 可用的 Hugo shortcodes：`admonition`（类型有 `note` / `info` / `warning` / `abstract` / `example`）、`center`、`left`、`right`、`fold`、`table`、`spotify`。引用提示框用 `{{% admonition note "标题" %}}...{{% /admonition %}}`。

## 写作风格（务必遵循）

- **第一人称、口语化、有态度**。像跟朋友掏心窝子讲话，可以带点情绪、自嘲和狠话（如"傻子都知道""屁话"），但不油滑。
- **从一段真实的个人经历或当下感受切入**作为钩子，再引出论点。
- **大量使用类比**来讲道理（已用过的：司马光砸缸、大禹治水、拆钟表、游泳、地图与山）。一个好类比胜过千言万语。
- **多用反问句**推进论证。
- 常**引用名家原话、书名或学者观点**，英文原句可用 blockquote，再给一句精炼的中文翻译。
- 善用 `##` 小标题分段；善用 `A → B → C` 这类箭头流程来对比"错误顺序 vs 正确顺序"，但不滥用。
- **结尾用一句点睛的短句收束**，留有余味。
- 篇幅：中等偏短，观点集中，不注水。
- 关键词、概念加书名号「」或 `**加粗**` 来强调。

## AI 写作署名

文末加一段写作说明，用 admonition shortcode，讲清"想法素材是我的、成文润色由模型完成"这层分工。措辞每次可微调，不要机械照抄：
```markdown
{{% admonition note "写作说明" %}}
本文的想法、素材与观点均出自我本人，成文则由 Anthropic 的 Claude Opus 4.8 模型按我的语言风格整理润色而成。
{{% /admonition %}}
```

## Commit 约定

- 提交信息用 `feat: ...` 前缀，正文用中文简述。新增专栏文章惯例为 `feat: add essay <文章标题>`。
- 仅在我明确要求时才 commit / push。
