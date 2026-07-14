# IdeaPocket

> 随口记下零散灵感，AI 在不改变原意的前提下整理表达，并把相关笔记聚合成可阅读的主题。

Android 优先 · React Native / Expo · 本地优先 · 单用户 · 无账号。

## 运行

```bash
npm ci
npx expo start
```

用 Expo Go 扫描终端二维码即可在真机运行。文字记录、搜索、主题和本地备份无需配置密钥。

真实语音转写与 AI 整理使用阿里云百炼。请在 App 内的“配置 API Key”中填写自己的个人 Key；密钥保存在设备安全存储中，绝不应提交到 GitHub。

项目锁定 Expo SDK 54（React Native 0.81 / React 19.1），与当前 Expo Go SDK 54 对齐。

## 当前能力

- **笔记首页**：全部笔记按创建时间倒序展示；默认单列，头部右侧可切换双列瀑布流。单列正文最多 4 行，瀑布流最多 6 行，整卡进入完整详情。
- **本地搜索**：笔记页顶部支持相关度排序的模糊关键词搜索，覆盖 AI 整理稿与原始转写；搜索只在设备本地执行，不上传笔记内容。
- **语音捕捉**：底部 56pt 鼠尾草绿主按钮，使用白色 SVG 波形与白色文案；轻点打开文字输入，按住录音，上滑取消，识别成功后直接入库。
- **笔记详情**：已有整理稿时可在“AI 整理 / 原始笔记”之间切换；整理稿可编辑，原文只读保留。
- **全屏详情与键盘避让**：笔记和主题详情均为 App 内不透明页面；Android 使用 `resize`，新增笔记输入与长文本编辑可随键盘调整并滚动。
- **长按管理**：长按笔记打开“编辑 / 删除”菜单；编辑自动聚焦正文，删除经过二次确认并同步移出主题。
- **AI 整理**：尚无整理稿时可调用 Qwen 去口水词和排版；先预览，再决定是否采用。
- **自动主题**：笔记变化后在后台分析全部笔记，识别多个类别并将同类内容聚合；每个正式主题至少 3 条，没有可靠归属的笔记保持独立。
- **主题详情与纠错**：按时间查看来源笔记和原始转写，可改名、移出错误笔记或解散主题。
- **可靠性**：AsyncStorage 本地持久化、启动加载保护、串行保存、错误提示和 AI/ASR 超时处理保持不变。
- **iOS 界面规范**：17pt 正文、44pt 最小触控区、56pt 语音主按钮、统一 Ionicons / Lucide SVG 图标和 Dynamic Type 增长空间；品牌绿色保持不变。
- **全屏语音反馈**：语音捕捉位于 App 根级，录音遮罩覆盖品牌、Tab 和内容区，并同步状态栏明暗。

## 2.0 当前边界

已完成：新版视觉令牌、顶部双导航、时间流卡片、详情编辑、AI 原文分层、底部语音主按钮、自动主题聚合与主题详情纠错。

尚未完成：真实用户数据调参、主题纠错撤销、相关笔记推荐、系统级捕捉入口、账号与多端同步。

旧版 heat / 堆肥 / 冒芽代码暂时保留，便于数据兼容和回退，但已退出主导航，不再驱动首页排序。

## 质量门禁

```bash
npm test
npx expo export --platform android --output-dir /private/tmp/ideapocket-export
```

## 文件结构

```text
App.js                         笔记 / 主题一级结构
src/theme.js                   鼠尾草绿颜色 + iOS 字体/间距/触控区令牌
src/presentation.js            日期、时间排序与主题卡派生
src/themeActions.js            主题校验、增量对齐与用户纠错
src/lib/themeAggregation.js    AI 聚合与无 Key 本地兜底
src/components/HomeHeader.js   品牌字标与顶部双导航
src/components/DetailPageHeader.js 笔记/主题全屏详情通用头部
src/components/NoteCard.js     笔记卡与长按管理
src/components/MasonryNoteList.js 双列瀑布流与真实高度测量
src/components/CaptureFab.js   文字 / 语音捕捉主按钮
src/components/VoiceWaveformIcon.js Lucide SVG 语音波形组件
src/screens/StreamScreen.js    倒序笔记流
src/masonry.js                 瀑布流估算与最短列布局算法
src/screens/ThemesScreen.js    主题生成状态与主题卡列表
src/screens/NoteDetailScreen.js 全屏笔记编辑与 AI/原文切换
src/screens/ThemeDetailScreen.js 全屏主题详情、来源追溯与纠错
src/detailRoutes.js            App 内轻量详情路由
src/useNotes.js                本地状态与持久化动作
src/lib/                       ASR、AI 整理、网络与串行队列
src/__tests__/                 核心自动测试
```
