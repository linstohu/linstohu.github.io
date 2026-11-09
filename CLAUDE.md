# linsto.org

本仓库是 Astro 静态站，内容在 `content/`，无数据库。修改前先阅读 README.md。

- 保留已确定的桌面及移动端视觉；不要加入阅读时长或文章里的相关声音。
- 声音包括播客和独立录音。此刻每月一个不可变地址，保留历史文件。
- 草稿和未来发布时间的内容不进入生产构建。所有示例必须保留 sample 标记。
- 密钥仅放本地 .env 或 GitHub Secrets，音频及大媒体放 R2。
- 只使用 packageManager 锁定的 pnpm 与 pnpm-lock.yaml；不要生成其他包管理器的锁文件。
- 内容规则集中在 src/lib/schemas.ts，CLI 与 Astro 必须共用。
- 完成后运行 pnpm run validate，检查移动布局和变更涉及的交互。
- 仅在用户明确要求时提交、推送或部署。不要擅自切换分支。
