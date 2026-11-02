# IdeaPocket

IdeaPocket 是一款 Android 优先、本地优先的灵感笔记应用。它用于快速记录文字或语音，把零散内容整理成可搜索、可回看的笔记与主题；无需注册账号。

## 功能

- 轻点底部按钮输入文字，长按录音并转写为笔记。
- 笔记按时间展示，支持双列瀑布流、本地模糊搜索、编辑和删除。
- 每条笔记可添加一张相册图片或相机照片。
- 使用 DeepSeek 进行 AI 文本整理和主题聚合，使用阿里云百炼进行语音转写；两种 API Key 由用户在设置页分别配置，并保存在设备安全存储中。
- 可选自动增量整理与手动检查，支持候选主题、归属依据、范围与摘要编辑、加入 / 移出、撤销、隐藏恢复及历史来源。
- 导出和导入本地备份，完整保留笔记、主题、人工规则、历史版本和图片。
- 界面自动跟随系统浅色或深色外观，并同步适配状态栏与 Android 导航栏。
- 支持 EAS 热更新，以及 Android App 内检查、下载和安装签名 APK 更新。

笔记、主题和图片默认保存在设备本地。应用更新采用同包名、同签名覆盖安装，不会主动卸载旧版本。

## 本地运行

```bash
npm ci
npx expo start
```

项目使用 Expo SDK 54。Expo Go 可用于常规界面与 JavaScript 功能调试；EAS Update 和 APK 自更新需要使用 preview 或 production APK 验证。

## 代码结构

```text
App.js                         应用入口与笔记/主题页面组织
src/components/                通用界面、笔记卡和输入组件
src/screens/                   笔记流、笔记详情、主题列表与详情
src/hooks/                     录音和应用更新相关 Hook
src/lib/                       AI、语音转写、备份、更新清单等逻辑
src/storage.js                 笔记与主题本地持久化
src/useNotes.js                笔记、主题、备份及保存队列
src/assets/                    应用图标和品牌资源
src/__tests__/                 单元测试
modules/ideapocket-updater/    Android APK 下载、校验与安装模块
scripts/                       发布清单生成脚本
app.json                       Expo 应用与 runtime 配置
eas.json                       preview、staging、production 构建通道
```

## 检查

```bash
npm test
npx expo export --platform android
```
