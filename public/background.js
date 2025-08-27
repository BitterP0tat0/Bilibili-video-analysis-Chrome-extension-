// Bilibili AI Summary 后台脚本
class AIService {
  constructor() {
    this.apiKey = null;
    this.apiProvider = 'openai'; // 默认使用OpenAI
    this.loadSettings();
  }

  // 加载用户设置
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['apiKey', 'apiProvider']);
      this.apiKey = result.apiKey;
      this.apiProvider = result.apiProvider || 'openai';
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  // 保存用户设置
  async saveSettings(apiKey, apiProvider) {
    try {
      await chrome.storage.sync.set({ apiKey, apiProvider });
      this.apiKey = apiKey;
      this.apiProvider = apiProvider;
      return true;
    } catch (error) {
      console.error('保存设置失败:', error);
      return false;
    }
  }

  // 调用OpenAI API
  async callOpenAI(prompt) {
    if (!this.apiKey) {
      throw new Error('请先配置OpenAI API密钥');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的视频内容总结助手。请根据提供的视频信息生成简洁、准确的中文总结。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API错误: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '无法生成总结';
  }

  // 调用KKSJ API
  async callKksjApi(prompt) {
    if (!this.apiKey) {
      throw new Error('请先配置KKSJ API密钥');
    }

    const response = await fetch('https://api.kksj.org/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的视频内容总结助手。请根据提供的视频信息生成简洁、准确的中文总结。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = response.statusText;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(`KKSJ API错误 (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '无法生成总结';
  }

  generatePrompt(videoData) {
    const { title, description, uploader, views, likes, duration, comments, subtitleContent, aiSubtitles } = videoData;

    let prompt = `请为以下Bilibili视频生成总结：

标题：${title}
UP主：${uploader}
时长：${duration}
播放量：${views}
点赞数：${likes}

视频描述：
${description}

`;

    // 优先使用AI字幕内容
    if (subtitleContent && subtitleContent.trim()) {
      prompt += `视频AI字幕内容：
${subtitleContent}

`;
      console.log('使用AI字幕内容生成总结');
    } else if (aiSubtitles && aiSubtitles.length > 0) {
      // 如果没有处理好的字幕文本，直接从字幕数组提取
      const subtitleText = aiSubtitles
        .filter(item => item.content && item.content.trim())
        .map(item => item.content.trim())
        .join(' ');

      if (subtitleText) {
        prompt += `视频AI字幕内容：
${subtitleText}

`;
        console.log('从AI字幕数组提取内容生成总结');
      }
    }

    if (comments && comments.length > 0) {
      prompt += `热门评论：\n`;
      comments.slice(0, 10).forEach((comment, index) => {
        prompt += `${index + 1}. ${comment.user}: ${comment.content}\n`;
      });
    }

    // 根据是否有字幕内容调整总结要求
    if (subtitleContent || (aiSubtitles && aiSubtitles.length > 0)) {
      prompt += `
请基于视频的AI字幕内容生成一个包含以下内容的总结：
1. 视频主要内容概述（基于字幕内容，2-3句话）
2. 关键要点和核心观点（从字幕中提取，3-5个要点）
3. 视频结构和逻辑梳理
4. 观众反馈总结（基于评论）
5. 推荐理由（1-2句话）

请用中文回答，格式清晰，内容简洁。重点关注字幕中的实际内容而不是描述信息。`;
    } else {
      prompt += `
请生成一个包含以下内容的总结：
1. 视频主要内容概述（2-3句话）
2. 关键要点（3-5个要点）
3. 观众反馈总结（基于评论）
4. 推荐理由（1-2句话）

请用中文回答，格式清晰，内容简洁。`;
    }

    return prompt;
  }

  async generateSummary(videoData) {
    try {
      const prompt = this.generatePrompt(videoData);

      switch (this.apiProvider) {
        case 'openai':
          return await this.callOpenAI(prompt);
        case 'kksjapi':
          return await this.callKksjApi(prompt);
        default:
          throw new Error(`不支持的AI服务提供商: ${this.apiProvider}`);
      }
    } catch (error) {
      console.error('生成总结失败:', error);
      throw error;
    }
  }

  async saveSummaryHistory(videoData, summary) {
    try {
      const historyKey = 'summaryHistory';
      const result = await chrome.storage.local.get([historyKey]);
      const history = result[historyKey] || [];
      
      const summaryRecord = {
        id: Date.now().toString(),
        videoUrl: videoData.url,
        videoTitle: videoData.title,
        uploader: videoData.uploader,
        summary,
        createdAt: new Date().toISOString()
      };

      history.unshift(summaryRecord);
      
      // 只保留最近100条记录
      if (history.length > 100) {
        history.splice(100);
      }

      await chrome.storage.local.set({ [historyKey]: history });
      return summaryRecord;
    } catch (error) {
      console.error('保存总结历史失败:', error);
      throw error;
    }
  }

  // 获取总结历史
  async getSummaryHistory() {
    try {
      const result = await chrome.storage.local.get(['summaryHistory']);
      return result.summaryHistory || [];
    } catch (error) {
      console.error('获取总结历史失败:', error);
      return [];
    }
  }
}

// 创建AI服务实例
const aiService = new AIService();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'generateSummary':
      aiService.generateSummary(request.videoData)
        .then(summary => {
          return aiService.saveSummaryHistory(request.videoData, summary)
            .then(record => {
              sendResponse({ success: true, summary, record });
            });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'saveSettings':
      aiService.saveSettings(request.apiKey, request.apiProvider)
        .then(success => {
          sendResponse({ success });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'getSettings':
      sendResponse({
        success: true,
        settings: {
          apiKey: aiService.apiKey,
          apiProvider: aiService.apiProvider
        }
      });
      break;

    case 'getSummaryHistory':
      aiService.getSummaryHistory()
        .then(history => {
          sendResponse({ success: true, history });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    default:
      sendResponse({ success: false, error: '未知的操作' });
  }
});

console.log('Bilibili AI Summary background script loaded');
