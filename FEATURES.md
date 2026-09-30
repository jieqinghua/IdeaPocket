# IdeaPocket 功能地图

> 本文件只回答“当前产品有什么”。以当前工作区代码为准，不承担历史记录或版本宣传。

## 固定模板（维护时保留字段与顺序）

每条功能必须按以下顺序填写：

```md
### 功能名称
- 做什么：用户能完成什么，不复述函数或组件。
- 入口：从用户可见界面如何到达；无界面入口时写“无用户入口”。
- 关键约束：数据、权限、联网、平台、可逆性、数量或失败边界。
- 证据：支撑本条结论的主要代码路径。
```

维护规则：行为、入口或约束变化时就地修改对应条目；新增模块时追加到合适章节。仅有内部实现变化、用户行为不变时，不改本文件。

## 1. 应用边界与数据

### Android 优先、本地优先、无账号
- 做什么：不注册账号即可记录和管理个人笔记；笔记、主题和图片默认保存在设备本地。
- 入口：安装并打开应用。
- 关键约束：笔记与主题使用 AsyncStorage；图片在应用私有文档目录；没有云同步或多端同步。语音转写、AI 润色、主题分析和更新检查会联网。
- 证据：`src/storage.js`、`src/noteImages.js`、`src/lib/stt.js`、`src/lib/aiTidy.js`、`src/lib/themeAnalysis.js`、`src/hooks/useAppUpdates.js`。

### 启动、保存与错误保护
- 做什么：启动时恢复本地笔记和主题；改动按顺序保存，并把读取或保存失败显示给用户。
- 入口：应用启动；保存失败时页面顶部出现提示，可点按关闭；读取失败时可重试。
- 关键约束：数据加载完成前不接受写入；笔记与主题分别串行落盘；中断的恢复事务会在下次启动继续完成。
- 证据：`App.js`、`src/useNotes.js`、`src/lib/serialQueue.js`、`src/storage.js`。

### 系统浅色 / 深色外观
- 做什么：界面跟随系统外观，并同步调整状态栏、Android 导航栏和启动画面。
- 入口：系统显示设置，无应用内主题开关。
- 关键约束：仅支持跟随系统；颜色通过语义主题统一提供；真机视觉效果仍受系统和设备实现影响。
- 证据：`src/theme.js`、`App.js`、`app.json`。

## 2. 快速捕捉

### 文字记录
- 做什么：用底部捕捉按钮打开输入条，输入一句或多段文字后保存为最新笔记。
- 入口：首页底部捕捉按钮，轻点后输入并点“记下”。
- 关键约束：空白内容不保存；来源记为 `text`；新笔记按创建时间显示在最前并播放入场反馈。
- 证据：`src/components/CaptureFab.js`、`src/components/CaptureBar.js`、`src/noteActions.js`、`src/screens/StreamScreen.js`。

### 按住录音并转写
- 做什么：按住底部按钮录音，松手后把语音转写成一条笔记；失败时可重试。
- 入口：首页底部捕捉按钮，长按超过 240ms；录音时上滑取消，松手提交。
- 关键约束：少于 600ms 的录音按误触处理；需要麦克风权限、网络和有效 API Key；音频上传到百炼兼容接口，成功后只保存文字而不把原录音纳入笔记数据；转写错误不会作为笔记保存。
- 证据：`src/components/CaptureFab.js`、`src/components/VoiceOverlay.js`、`src/hooks/useRecorder.js`、`src/lib/stt.js`、`app.json`。

### 捕捉反馈与取消
- 做什么：录音、取消、识别和成功反馈在同一遮罩中连续呈现，减少状态跳转。
- 入口：长按捕捉按钮后自动出现。
- 关键约束：上滑超过约 70px 进入取消状态；识别中禁止重复发起；关闭或失败时保留明确反馈和可用的重试路径。
- 证据：`src/components/CaptureFab.js`、`src/components/VoiceOverlay.js`、`src/voiceCaptureState.js`、`src/voiceWaveform.js`。

## 3. 笔记流与找回

### 时间倒序笔记流
- 做什么：按最新在前展示所有未删除笔记，并显示正文预览、日期、来源 / AI 状态和可选图片缩略图。
- 入口：首页“笔记”页。
- 关键约束：软删除笔记不会出现；正文预览会截断，完整内容需进入详情；默认布局为双列瀑布流。
- 证据：`src/screens/StreamScreen.js`、`src/components/NoteCard.js`、`src/presentation.js`。

### 单列 / 双列瀑布流切换
- 做什么：在适合连续阅读的单列与更紧凑的双列布局之间切换。
- 入口：首页“笔记”页右上角列表 / 网格图标。
- 关键约束：布局偏好当前只保存在本次运行状态，重启后回到默认双列；两种布局分别保留滚动位置。
- 证据：`App.js`、`src/components/HomeHeader.js`、`src/components/MasonryNoteList.js`、`src/masonry.js`。

### 本地精确与模糊搜索
- 做什么：搜索当前正文和 AI 润色前原文；先返回规范化直接命中，再返回容错模糊命中。
- 入口：首页“笔记”页顶部搜索框。
- 关键约束：完全在本地运行，不上传笔记；忽略大小写、全半角、常见空白和标点；单字符只做直接匹配；已删除笔记不参与；仅原文命中时显示提示。
- 证据：`src/screens/StreamScreen.js`、`src/search.js`、`src/components/NoteCard.js`。

### 笔记 / 主题横向切换
- 做什么：通过顶部标签或横向滑动在笔记与主题页面之间切换。
- 入口：首页顶部“笔记 / 主题”标签；内容区水平滑动。
- 关键约束：搜索聚焦或语音遮罩活跃时不抢占横滑；页面分别保留滚动位置。
- 证据：`App.js`、`src/components/HomeHeader.js`、`src/homeTabSwipe.js`。

## 4. 笔记详情与管理

### 查看与编辑完整笔记
- 做什么：查看完整内容、创建时间和来源，并显式进入编辑状态保存修改。
- 入口：轻点任意笔记卡；长按卡片后点“编辑”可直接进入编辑状态。
- 关键约束：空白修改不保存；编辑会更新接触时间与强度；Android 返回键可退出详情。
- 证据：`src/components/NoteCard.js`、`src/screens/NoteDetailScreen.js`、`src/detailRoutes.js`、`src/noteActions.js`。

### 长按卡片快捷管理
- 做什么：在当前卡片上直接显示编辑和删除动作，避免离开上下文。
- 入口：长按笔记卡约 450ms。
- 关键约束：长按后会抑制同一次触摸的普通打开；同一时间只展开一张卡；点外部关闭。
- 证据：`src/components/NoteCard.js`、`src/screens/StreamScreen.js`、`src/components/MasonryNoteList.js`。

### 软删除
- 做什么：确认后把笔记移出笔记流和主题，而不是立即擦除正文数据。
- 入口：卡片长按菜单或笔记详情右上角菜单中的删除。
- 关键约束：写入 `deletedAt`；从当前主题成员中移除；当前没有面向用户的回收站或恢复入口，但备份默认仍包含软删除笔记。
- 证据：`src/noteActions.js`、`src/useNotes.js`、`src/themeModel.js`、`src/lib/backupExport.js`。

### 单张图片附件
- 做什么：给一条笔记添加一张相册图片或相机照片，在卡片和详情中查看。
- 入口：笔记详情的“添加图片”；已有图片可点开全屏查看，再选择更换或删除。
- 关键约束：每条笔记最多一张；需要相册或相机权限；保存前转为 JPEG，最长边不超过 2000px、质量 0.85；图片存于应用私有目录，不参与 AI 润色或主题分析；更换前需确认。
- 证据：`src/screens/NoteDetailScreen.js`、`src/noteImages.js`、`src/components/NoteCard.js`、`app.json`。

## 5. AI 辅助

### API Key 配置与安全存储
- 做什么：分别配置 DeepSeek 文本 AI Key 和百炼录音转写 Key，并查看各自是否已配置。
- 入口：首页右上角“更多选项”→“设置”→“AI 服务配置”。
- 关键约束：DeepSeek 用于 AI 润色和主题分析，百炼仅用于录音转写；两种 Key 使用独立 SecureStore 记录保存，不进入笔记备份。没有 DeepSeek Key 时文本功能使用本地兜底；没有百炼 Key 时不能转写录音。
- 证据：`src/components/HomeHeader.js`、`src/screens/SettingsScreen.js`、`src/aiKeyStorage.js`、`App.js`、`src/config.ai.js`。

### AI 润色候选与原文保留
- 做什么：对单条笔记做轻度纠错、去口水、标点和结构整理；先展示候选，由用户决定采用还是保留原文。
- 入口：笔记详情的“AI 润色”。
- 关键约束：由 DeepSeek 文本 AI 生成，但不得静默覆盖；首次采用整理稿时把原文保存为 `rawText`；明显有“第一 / 第二”等顺序时转为纯文本列表；空结果、无变化或异常增减会被识别，远端异常最多再复核一次；不应补充原文没有的信息。
- 证据：`src/screens/NoteDetailScreen.js`、`src/components/AiPolishCandidateCard.js`、`src/lib/aiTidy.js`、`src/aiTextTransition.js`、`src/noteActions.js`。

### 原文追溯
- 做什么：采用 AI 润色后仍可查看整理前原文；搜索和主题详情也能回到原文核对。
- 入口：笔记详情的原始笔记区域；主题详情每条已润色笔记的“查看原文”；搜索原文命中提示。
- 关键约束：再次编辑当前正文不会改写首次保存的 `rawText`；原文只读。
- 证据：`src/screens/NoteDetailScreen.js`、`src/screens/ThemeDetailScreen.js`、`src/search.js`、`src/noteActions.js`。

## 6. 主题整理

### 可选自动整理与手动补跑
- 做什么：新增或编辑文字后增量判断已有主题归属，积累新方向；保留待处理、全库检查、暂停和重试入口。
- 入口：首页“主题”页的自动整理开关、“处理待整理笔记 / 检查全部笔记”和“暂停本轮”。
- 关键约束：默认关闭，开启前说明联网范围；引导、演示、已删除笔记和图片不参与。保存不等待分析；仅在前台处理，离开前台或输入 / 人工规则变化时取消旧任务，返回后可继续。失败保留原状态，并停止反复请求同一输入。
- 证据：`src/useNotes.js`、`src/screens/ThemesScreen.js`、`src/lib/themeAnalysis.js`、`src/lib/http.js`。

### 内容表示与关系判断
- 做什么：在全文建立本地词项索引和缓存，检索相关笔记与主题，再用配置的 DeepSeek 校验关系；归属附理由与来源片段。
- 入口：自动整理或手动检查；详情中的归属依据与加入建议。
- 关键约束：远程分析读取有预算的相关片段，不等于模型阅读每篇全文。没有文本 AI Key 时使用词项相关性与来源摘录；用户管理主题在本地模式只收加入建议。每轮最多 4 批、每批 8 条待判断笔记，以及 4 份摘要；每个远程请求输入不超过 18,000 字符、输出上限 4,096 tokens，整轮请求限时 60 秒，余量分轮继续。阈值和真实分类质量仍待使用样本校准。
- 证据：`src/lib/themeRetrieval.js`、`src/lib/themeAnalysis.js`、`src/useNotes.js`。

### 候选、自动与用户管理主题
- 做什么：区分新方向候选、成熟自动主题和由用户管理的主题；明确相关可自动加入，弱关联显示建议，允许不归类。
- 入口：首页“主题”列表、候选区和主题详情。
- 关键约束：当前暂用 2 条不同内容形成候选、3 条成长为成熟主题；人工创建允许 1 条。成熟主题保持身份、名称与范围，新增笔记不重排未修改的旧成员；正文变化可重新判断其自动归属。自动归属最多 2 处，人工归属不占此名额；无全库 5 主题上限。主题管理方式与自动加入开关独立。
- 证据：`src/themeModel.js`、`src/lib/themeAnalysis.js`、`src/screens/ThemesScreen.js`、`src/screens/ThemeDetailScreen.js`。

### 人工创建、纠偏与撤销
- 做什么：从笔记创建主题，保留当前主题，编辑名称、范围和摘要，手动加入 / 移出笔记；撤销最近调整。
- 入口：主题页“创建主题”；详情中的编辑、加入、移出、保留和撤销入口。
- 关键约束：加入 / 排除规则独立持久化并优先于自动结果；多选加入作为一次调整。名称最多 80 字符、范围 1,200 字符、摘要 3,000 字符；人工摘要及用户采用的更新稿不会被静默覆盖。全局保留最近 20 项人工撤销记录，撤销不恢复已删除的笔记；旧历史与隐藏主题先恢复后编辑。
- 证据：`src/themeModel.js`、`src/useNotes.js`、`src/components/ThemeEditor.js`、`src/screens/ThemeDetailScreen.js`。

### 摘要与来源版本
- 做什么：展示 AI 摘要、本地摘录、人工摘要或旧版摘要；成员、正文或范围变化后提示待更新。自动摘要按最终有效成员生成，人工摘要接收更新候选。
- 入口：主题详情“更新摘要 / 编辑摘要 / 采用这份摘要”和“变化记录”。
- 关键约束：服务格式错误与有效空结果分开；摘要缺来源、片段不足或超预算时不会把旧稿标为最新。变化记录引用独立正文快照，可追溯当时成员与摘要；旧数据没有的正文版本明确标注，不补造。当前完整版本记录未设置清理期限，快照按内容复用。
- 证据：`src/themeModel.js`、`src/lib/themeAnalysis.js`、`src/screens/ThemeDetailScreen.js`。

### 隐藏、恢复与旧主题记录
- 做什么：隐藏主题并随时恢复；隐藏期间可接收建议，也可独立选择不再建议该方向；旧版历史记录继续可访问。
- 入口：详情“隐藏主题”；主题页“已隐藏主题 / 旧主题记录”；隐藏详情的恢复与抑制开关。
- 关键约束：隐藏不删除笔记；恢复解除方向抑制、保留人工加入 / 排除规则并标记摘要待更新。旧版“已保留”迁移为用户管理且默认关闭自动加入；旧“已解散”保留抑制信息。上下层主题及成熟主题合并 / 拆分建议属于下一阶段，尚未实现。
- 证据：`src/themeModel.js`、`src/useNotes.js`、`src/screens/ThemesScreen.js`、`src/screens/ThemeDetailScreen.js`。

## 7. 备份与恢复

### 文件夹备份导出
- 做什么：导出一个带时间戳的备份文件夹，包含机器可恢复的 JSON、人可读 Markdown 和图片子目录。
- 入口：首页右上角“更多选项”→“导出笔记”。
- 关键约束：Android 优先让用户选择目标目录，失败时回退到应用文档目录；默认排除演示数据、保留软删除笔记；任何图片复制或文件写入失败都会删除本次不完整备份并报错。
- 证据：`App.js`、`src/backupFiles.js`、`src/lib/backupExport.js`、`src/noteImages.js`。

### 备份文件夹导入
- 做什么：读取完整备份文件夹，预览笔记 / 主题 / 图片数量，并选择合并或覆盖恢复。
- 入口：首页右上角“更多选项”→“导入笔记”→选择文件夹。
- 关键约束：文件夹内必须恰有一个受支持的 IdeaPocket JSON；图片从同级 `images/` 恢复；开始前自动备份当前数据；导入通过恢复日志避免笔记与主题只写入一半。完整恢复主题、人工约束、来源快照、版本和撤销；兼容旧备份。合并保留本地主题和自动整理设置，并映射导入的笔记 / 主题 ID；覆盖采用备份设置。检索缓存会重建，未完成手动任务不会自动恢复；恢复事务待续写时保留图片并暂停写入。
- 证据：`App.js`、`src/backupFiles.js`、`src/lib/backupImport.js`、`src/storage.js`、`src/useNotes.js`。

## 8. 更新与发布

### EAS 热更新
- 做什么：在不重装 APK 的情况下获取兼容当前 runtime 的 JavaScript / 资源更新，并在用户确认后重启应用。
- 入口：应用前台自动静默检查；或首页右上角“更多选项”→“检查更新”。
- 关键约束：开发模式与未启用 Updates 的包不执行；安装前等待本地保存完成并创建安全备份；`runtimeVersion` 跟随应用版本。
- 证据：`src/hooks/useAppUpdates.js`、`src/lib/updateSafety.js`、`app.json`、`eas.json`。

### Android 签名 APK 自更新
- 做什么：从 GitHub Release 获取更新清单，在系统 DownloadManager 中下载、校验 SHA-256，并打开系统安装器覆盖安装。
- 入口：首页右上角“更多选项”→“检查更新”；前台也会恢复下载状态。
- 关键约束：仅 Android 且安装包必须包含原生更新模块；只接受 HTTPS、合法 APK 文件名、正整数版本码和 64 位 SHA-256；安装前保存并备份本地数据；需要系统允许安装未知来源应用。Expo Go 不支持该能力。
- 证据：`src/hooks/useAppUpdates.js`、`src/lib/updateManifest.js`、`src/nativeUpdater.js`、`modules/ideapocket-updater/`。

## 9. 已决定移除的遗留代码（不属于当前功能）

### 热度、种下、堆肥与冒芽遗留代码
- 做什么：不提供当前产品能力；代码仍能计算笔记热度、把低热度内容视为堆肥、选择每日冒芽，并执行“浇水”和“种下”等旧动作。
- 入口：无用户入口；当前 `App.js` 不渲染对应屏幕。
- 关键约束：已确认后续移除，不再规划重新启用；移除时需同时处理遗留屏幕、动作、配置、测试、欢迎笔记文案和已有本地数据兼容，避免误伤当前笔记。完成删除前不得写入当前版本用户说明。
- 证据：`src/heat.js`、`src/screens/CompostScreen.js`、`src/screens/SproutScreen.js`、`src/sprout.js`、`src/useNotes.js`、`src/noteActions.js`；当前 `App.js` 未渲染这些屏幕。
