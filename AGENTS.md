# IdeaPocket 项目规则

## Conversation image preservation

When a user directly pastes one or more images from the clipboard into the current conversation message, preserve each pasted image **before** analysing it or giving the substantive reply.

1. Create `<project-root>/reference-image/` when it does not exist.
2. If the image is available to the agent as a local file, copy the original bytes into that folder. Do not move, recompress, convert, or overwrite the source image.
3. Use a collision-safe filename: `YYYYMMDD-HHMMSS-<index>-<descriptive-slug>.<original-extension>`. Preserve the source extension whenever it is known.
4. In the reply, state the saved project-relative path(s). This makes the conversation an index, not the sole image store.
5. If Codex exposes only an unavailable or expired temporary reference (or does not provide a local source path), do not claim that the image was saved. State the limitation briefly and ask the user to attach the original file again; save it immediately once available.

Apply this rule **only** to images directly pasted from the clipboard. Do not create a duplicate for file attachments, screenshots supplied as files, visual tool outputs, project assets, image URLs, or any other image source unless the user explicitly asks.

## 文档同步是完成条件

本项目用四份根级文档分别维护四个维度：

- `FEATURES.md`：当前功能地图，只写现在做什么、入口和关键约束。
- `CHANGELOG.md`：按日期倒序记录改动和原因；理由没有证据就写“原因待补”。
- `RELEASE_NOTES.md`：给用户看的版本变化，只写用户可感知内容。
- `METHODOLOGY.md`：非显然问题的根因、形成的取舍与防再犯检查。

每次改动在提交或交付前，必须按下表检查并同步对应文档。文档未同步的改动视为未完成。

| 改动类型 | FEATURES.md | CHANGELOG.md | RELEASE_NOTES.md | METHODOLOGY.md |
|---|---|---|---|---|
| 新增 / 删除用户功能、入口或关键约束 | 必须 | 必须 | 必须 | 仅当形成可复用取舍或解决非显然坑 |
| 修改用户可见行为、文案、权限、兼容性或失败方式 | 必须（若地图事实变化） | 必须 | 必须 | 仅当有非显然根因 / 防再犯规则 |
| 修复用户可感知 Bug | 若功能约束变化则更新 | 必须 | 必须 | 非显然问题必须 |
| 数据模型、存储、备份、迁移、安全或发布流程变化 | 若影响能力 / 约束则更新 | 必须 | 用户可感知时必须 | 非显然风险或新门槛必须 |
| 纯内部重构、测试、构建或依赖变化，用户行为不变 | 不更新 | 必须写原因；纯机械噪声可合并到同日条目 | 不更新 | 只有产生新方法或防再犯检查时更新 |
| 仅调研、方案或未实现计划 | 不写成现有功能 | 只有形成项目决策时记录，并明确“未实现” | 不更新 | 形成稳定方法时可更新 |
| 发布一个版本 | 复核当前事实 | 必须记录版本与日期 | 必须整理该版本 | 复核本版本是否产生新经验 |

## 文档写作约束

1. 先查当前代码、测试、现有文档和 Git 历史，再写结论；不要从文件名或最终代码反推历史动机。
2. 不编造日期、版本、发布状态或决策理由。无法证明时使用“日期待确认”“发布日期待确认”“原因待补”或“待确认”。
3. 原因优先写用户问题、产品边界、数据风险或工程取舍，不写“因为新增了某函数”之类的代码复述。
4. 四份文档各守边界。同一事实可分别用“现状 / 历史 / 用户语言 / 方法论”表达，但不要整段复制。
5. `CHANGELOG.md` 按日期倒序；未提交改动不得擅自使用当天日期，除非改动确实在本次任务中完成并明确标为本次新增。
6. `RELEASE_NOTES.md` 不写内部重构、依赖名、测试数量、提交 SHA 或用户无法感知的实现细节。
7. `METHODOLOGY.md` 只收录已理解的非显然根因。根因仍不确定时先写“根因待确认”，不要把猜测固化为规则。
8. 修改文档模板或本规则本身时，也要在 `CHANGELOG.md` 记录原因。
