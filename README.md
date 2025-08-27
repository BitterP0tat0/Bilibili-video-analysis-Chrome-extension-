# B站总结 (Bilibili AI Summary)

一个智能的Chrome扩展，能够自动提取Bilibili视频的AI字幕并生成智能总结。

## ✨ 功能特点

### 🎯 核心功能
- **AI字幕提取**: 自动从Bilibili视频中提取AI生成的字幕内容
- **智能总结**: 基于字幕内容生成结构化的视频总结
- **多AI支持**: 支持OpenAI和KKSJ API两种AI服务
- **字幕展示**: 可折叠的完整字幕内容展示，支持时间戳格式
- **一键复制**: 快速复制字幕内容到剪贴板

### 🎨 用户体验
- **状态保持**: 页面状态自动保存，重新打开时恢复
- **新标签页模式**: 支持在新标签页中打开，避免popup自动关闭
- **实时反馈**: 详细的操作状态提示和错误信息
- **历史记录**: 自动保存总结历史，方便回顾

## 🚀 快速开始

### 安装要求
- Chrome 88+ 浏览器
- Node.js 16+ 和 npm

### 构建安装
1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd extension
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建扩展**
   ```bash
   npm run build
   ```

4. **加载到Chrome**
   - 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目的 `dist` 文件夹

### 配置API
1. 点击扩展图标，切换到"设置"标签
2. 选择AI服务提供商：
   - **OpenAI**: 需要OpenAI API密钥
   - **KKSJ API**: 需要KKSJ API密钥
3. 输入对应的API密钥并保存

## 📖 使用指南

### 基本使用流程
1. **访问Bilibili视频页面**
2. **点击扩展图标**
3. **提取视频数据** - 自动获取视频信息和AI字幕
4. **查看字幕内容** - 点击展开完整字幕（带时间戳）
5. **生成AI总结** - 基于字幕内容生成智能总结
6. **复制分享** - 一键复制字幕或总结内容

### 高级功能
- **🔗 新标签页模式**: 点击右上角链接图标在新标签页打开
- **🔄 手动获取字幕**: 如果自动获取失败，可手动尝试
- **🔍 检查字幕**: 检测当前页面的字幕可用性
- **📚 历史记录**: 查看之前的总结记录

## 🛠️ 技术架构

### 前端技术栈
- **React 19** - 用户界面框架
- **TypeScript** - 类型安全的JavaScript
- **Vite** - 现代化构建工具
- **Lucide React** - 图标库

### 扩展架构
- **Manifest V3** - 最新的Chrome扩展标准
- **Content Script** - 页面内容提取和网络拦截
- **Background Script** - AI API调用和数据处理
- **Popup Interface** - 用户交互界面

### 核心模块
```
src/
├── App.tsx              # 主应用组件
├── App.css              # 样式文件
├── main.tsx             # 应用入口
└── index.css            # 全局样式

public/
├── manifest.json        # 扩展配置
├── background.js        # 后台脚本
├── content.js           # 内容脚本
└── icons/              # 图标资源
```

## 🔧 开发指南

### 开发环境
```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 代码检查
npm run lint
```

### 调试方法
1. **内容脚本调试**: 在Bilibili页面按F12查看Console
2. **后台脚本调试**: 在扩展管理页面点击"检查视图"
3. **Popup调试**: 右键扩展图标选择"检查弹出式窗口"

### 字幕获取原理
扩展通过拦截网络请求获取AI字幕：
```javascript
// 监听包含 ai_subtitle 的请求
if (url.includes('ai_subtitle')) {
  // 解析响应中的 body 数组
  if (data.body && Array.isArray(data.body)) {
    // 提取每个字幕项的 content 字段
    const subtitles = data.body.filter(item => item.content);
  }
}
```

## 📋 API支持

### OpenAI API
- **模型**: GPT-3.5-turbo
- **端点**: `https://api.openai.com/v1/chat/completions`
- **获取密钥**: [OpenAI Platform](https://platform.openai.com/api-keys)

### KKSJ API
- **模型**: 多种AI模型支持
- **端点**: `https://api.kksj.org/v1/chat/completions`
- **获取密钥**: [KKSJ API](https://api.kksj.org)

## 🐛 故障排除

### 常见问题

**Q: 没有获取到字幕**
- 确认视频有AI字幕功能（播放器有字幕按钮）
- 尝试点击"🔄 手动获取字幕"
- 查看控制台是否有错误信息

**Q: API调用失败**
- 检查API密钥是否正确
- 确认网络连接正常
- 验证API服务商账户余额

**Q: Popup自动关闭**
- 点击右上角🔗图标在新标签页打开
- 或右键扩展图标选择"选项"

### 调试日志
在控制台查找以下关键日志：
- `🎯 发现AI字幕请求` - 网络拦截成功
- `✅ 找到字幕body数组` - 数据解析成功
- `🎉 成功提取X条AI字幕` - 字幕提取完成

## 🤝 贡献指南

### 提交问题
- 使用GitHub Issues报告bug
- 提供详细的复现步骤
- 包含控制台错误信息

### 开发贡献
1. Fork项目
2. 创建功能分支
3. 提交代码更改
4. 创建Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Bilibili](https://www.bilibili.com) - 提供优质的视频平台
- [OpenAI](https://openai.com) - AI技术支持
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/) - 扩展开发平台

## 📞 联系方式

- 项目主页: [GitHub Repository]
- 问题反馈: [GitHub Issues]
- 邮箱: [your-email@example.com]

---

**⭐ 如果这个项目对您有帮助，请给个Star支持一下！**
