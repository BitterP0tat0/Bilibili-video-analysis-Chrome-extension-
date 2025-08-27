// Bilibili内容提取脚本
class BilibiliContentExtractor {
  constructor() {
    this.videoData = null;
    this.isExtracted = false;
    this.aiSubtitles = [];
    this.setupNetworkInterception();
  }

  // 设置网络请求拦截
  setupNetworkInterception() {
    console.log('设置网络请求拦截...');

    // 拦截fetch请求
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      // 检查是否是字幕相关请求
      const url = args[0];
      if (url && typeof url === 'string') {
        // 只记录ai_subtitle相关的URL
        if (url.includes('ai_subtitle')) {
          console.log('🎯 发现AI字幕请求:', url);

          try {
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();
            console.log('🎯 AI字幕响应数据:', data);

            // 专门处理ai_subtitle响应
            if (data && data.body && Array.isArray(data.body)) {
              console.log('✅ 找到字幕body数组，长度:', data.body.length);
              console.log('📝 字幕示例:', data.body.slice(0, 3));
              this.processAiSubtitles(data);
            } else {
              console.log('❌ AI字幕响应格式不正确:', Object.keys(data || {}));
            }
          } catch (error) {
            console.error('❌ 处理AI字幕数据失败:', error);
          }
        }
      }

      return response;
    };

    // 拦截XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this._url = url;
      console.log('XHR请求URL:', url);
      return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(...args) {
      if (this._url && this._url.includes('ai_subtitle')) {
        console.log('🎯 监听AI字幕XHR请求:', this._url);
        this.addEventListener('load', function() {
          try {
            const data = JSON.parse(this.responseText);
            console.log('🎯 AI字幕XHR响应数据:', data);

            // 专门处理ai_subtitle响应
            if (data && data.body && Array.isArray(data.body)) {
              console.log('✅ XHR找到字幕body数组，长度:', data.body.length);
              console.log('📝 XHR字幕示例:', data.body.slice(0, 3));
              window.bilibiliExtractor?.processAiSubtitles(data);
            } else {
              console.log('❌ XHR AI字幕响应格式不正确:', Object.keys(data || {}));
            }
          } catch (error) {
            console.error('❌ 处理XHR AI字幕数据失败:', error);
          }
        });
      }
      return originalXHRSend.call(this, ...args);
    };

    console.log('网络请求拦截设置完成');
  }

  // 处理AI字幕数据
  processAiSubtitles(data) {
    try {
      console.log('🔄 开始处理AI字幕数据:', data);

      // 专门处理ai_subtitle响应格式
      let subtitles = [];

      // ai_subtitle的标准格式: data.body 数组
      if (data && data.body && Array.isArray(data.body)) {
        subtitles = data.body;
        console.log('✅ 从data.body提取字幕，数量:', subtitles.length);
      }
      // 备用格式检查
      else if (data && data.data && Array.isArray(data.data.body)) {
        subtitles = data.data.body;
        console.log('✅ 从data.data.body提取字幕，数量:', subtitles.length);
      }
      // 如果直接是数组
      else if (Array.isArray(data)) {
        subtitles = data;
        console.log('✅ 直接从data数组提取字幕，数量:', subtitles.length);
      }
      else {
        console.log('❌ 未找到字幕数据，数据结构:', Object.keys(data || {}));
        console.log('❌ 完整数据:', data);
        return;
      }

      if (subtitles.length > 0) {
        console.log('📝 原始字幕数据示例:', subtitles.slice(0, 2));

        // AI字幕的标准格式验证: 每个元素应该有 from, to, content 等字段
        const validSubtitles = subtitles.filter(item => {
          const isValid = item &&
                         typeof item === 'object' &&
                         item.content &&
                         typeof item.content === 'string' &&
                         item.content.trim().length > 0;

          if (!isValid && item) {
            console.log('❌ 无效字幕项:', item);
          }

          return isValid;
        });

        if (validSubtitles.length > 0) {
          this.aiSubtitles = validSubtitles;
          console.log(`🎉 成功提取${validSubtitles.length}条AI字幕`);
          console.log('📝 字幕示例:', validSubtitles.slice(0, 3).map(s => ({
            from: s.from,
            to: s.to,
            content: s.content.substring(0, 20) + '...'
          })));

          const subtitleText = this.getSubtitleText();
          const formattedText = this.getFormattedSubtitleText();
          console.log('📊 生成的字幕文本长度:', subtitleText.length);
          console.log('📊 格式化字幕文本长度:', formattedText.length);
          console.log('📄 字幕文本预览:', subtitleText.substring(0, 100) + '...');

          if (this.videoData) {
            this.videoData.aiSubtitles = this.aiSubtitles;
            this.videoData.subtitleContent = subtitleText;
            this.videoData.formattedSubtitleContent = formattedText;
            console.log('✅ 已更新视频数据中的字幕信息');
          }

          window.dispatchEvent(new CustomEvent('subtitlesUpdated', {
            detail: {
              count: validSubtitles.length,
              content: subtitleText,
              formatted: formattedText
            }
          }));

          console.log('🎊 字幕处理完成！');
        } else {
          console.log('❌ 字幕数据格式不正确，没有找到有效的content字段');
          console.log('❌ 检查的数据结构:', subtitles.slice(0, 2));
        }
      } else {
        console.log('❌ 字幕数组为空');
      }
    } catch (error) {
      console.error('处理AI字幕数据时出错:', error);
    }
  }

  findSubtitleArray(obj, depth = 0) {
    if (depth > 10) return []; 

    if (Array.isArray(obj)) {
      if (obj.length > 0 && obj[0] && obj[0].content) {
        return obj;
      }
    }

    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        const result = this.findSubtitleArray(obj[key], depth + 1);
        if (result.length > 0) {
          console.log(`在${key}中找到字幕数组`);
          return result;
        }
      }
    }

    return [];
  }

  // 获取字幕文本内容
  getSubtitleText() {
    if (!this.aiSubtitles || this.aiSubtitles.length === 0) {
      return '';
    }

    return this.aiSubtitles
      .filter(item => item.content && item.content.trim())
      .map(item => item.content.trim())
      .join(' ');
  }

  // 获取格式化的字幕内容（带时间戳）
  getFormattedSubtitleText() {
    if (!this.aiSubtitles || this.aiSubtitles.length === 0) {
      return '';
    }

    return this.aiSubtitles
      .filter(item => item.content && item.content.trim())
      .map(item => {
        const startTime = this.formatTime(item.from);
        const endTime = this.formatTime(item.to);
        return `[${startTime} - ${endTime}] ${item.content.trim()}`;
      })
      .join('\n');
  }

  // 格式化时间（秒转换为 mm:ss 格式）
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // 检查页面是否有字幕功能
  checkSubtitleAvailability() {
    console.log('=== 检查页面字幕可用性 ===');

    // 检查播放器是否有字幕按钮
    const subtitleButtons = [
      '.bpx-player-ctrl-subtitle',
      '.bilibili-player-video-btn-subtitle',
      '.squirtle-subtitle-btn',
      '[data-text="字幕"]',
      '.subtitle-btn'
    ];

    let hasSubtitleButton = false;
    for (const selector of subtitleButtons) {
      const button = document.querySelector(selector);
      if (button) {
        console.log('找到字幕按钮:', selector, button);
        hasSubtitleButton = true;
        break;
      }
    }

    // 检查播放器容器
    const playerContainers = [
      '.bpx-player-container',
      '.bilibili-player',
      '.squirtle-video-player',
      '#bilibili-player'
    ];

    let hasPlayer = false;
    for (const selector of playerContainers) {
      const player = document.querySelector(selector);
      if (player) {
        console.log('找到播放器:', selector);
        hasPlayer = true;
        break;
      }
    }

    // 检查页面类型
    const isVideoPage = window.location.pathname.includes('/video/');
    const hasVideoElement = document.querySelector('video') !== null;

    console.log('字幕可用性检查结果:', {
      hasSubtitleButton,
      hasPlayer,
      isVideoPage,
      hasVideoElement,
      url: window.location.href
    });

    return {
      hasSubtitleButton,
      hasPlayer,
      isVideoPage,
      hasVideoElement,
      likely: hasPlayer && isVideoPage
    };
  }

  // 手动获取字幕数据
  async tryFetchSubtitles() {
    try {
      console.log('=== 开始手动获取字幕数据 ===');

      // 方法1: 从URL中提取视频ID
      const url = window.location.href;
      console.log('当前URL:', url);

      const bvMatch = url.match(/\/video\/(BV\w+)/);
      const avMatch = url.match(/\/video\/av(\d+)/);

      let bvid = null;
      let aid = null;

      if (bvMatch) {
        bvid = bvMatch[1];
        console.log('提取到BV号:', bvid);
      } else if (avMatch) {
        aid = avMatch[1];
        console.log('提取到AV号:', aid);
      } else {
        console.log('无法从URL提取视频ID');
        return false;
      }

      // 方法2: 尝试从页面元素获取视频信息
      let cid = null;
      try {
        // 尝试从window对象获取
        if (window.__INITIAL_STATE__) {
          const initialState = window.__INITIAL_STATE__;
          console.log('找到__INITIAL_STATE__');
          if (initialState.videoData) {
            cid = initialState.videoData.cid;
            bvid = bvid || initialState.videoData.bvid;
            aid = aid || initialState.videoData.aid;
          }
        }

        // 尝试从其他全局变量获取
        if (!cid && window.__playinfo__) {
          console.log('找到__playinfo__');
          // 可能包含播放信息
        }
      } catch (e) {
        console.log('从页面元素获取信息失败:', e);
      }

      // 方法3: 通过API获取视频信息
      if (!cid) {
        try {
          let videoInfoUrl;
          if (bvid) {
            videoInfoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
          } else if (aid) {
            videoInfoUrl = `https://api.bilibili.com/x/web-interface/view?aid=${aid}`;
          } else {
            console.log('没有有效的视频ID');
            return false;
          }

          console.log('请求视频信息:', videoInfoUrl);
          const videoInfoResponse = await fetch(videoInfoUrl);
          const videoInfo = await videoInfoResponse.json();

          console.log('视频信息响应:', videoInfo);

          if (videoInfo.code !== 0) {
            console.log('获取视频信息失败:', videoInfo.message);
            return false;
          }

          cid = videoInfo.data.cid;
          bvid = bvid || videoInfo.data.bvid;
          aid = aid || videoInfo.data.aid;
        } catch (error) {
          console.error('API获取视频信息失败:', error);
          return false;
        }
      }

      console.log('最终视频信息 - CID:', cid, 'BVID:', bvid, 'AID:', aid);

      if (!cid) {
        console.log('无法获取视频CID');
        return false;
      }

      // 方法4: 获取播放器信息（包含字幕）
      try {
        const playerInfoUrl = `https://api.bilibili.com/x/player/v2?cid=${cid}&bvid=${bvid || ''}`;
        console.log('请求播放器信息:', playerInfoUrl);

        const playerResponse = await fetch(playerInfoUrl);
        const playerInfo = await playerResponse.json();

        console.log('播放器信息响应:', playerInfo);

        if (playerInfo.code === 0 && playerInfo.data) {
          // 检查字幕信息
          if (playerInfo.data.subtitle && playerInfo.data.subtitle.subtitles) {
            const subtitles = playerInfo.data.subtitle.subtitles;
            console.log('找到字幕列表:', subtitles);

            // 尝试获取每个字幕文件
            for (const subtitle of subtitles) {
              if (subtitle.subtitle_url) {
                try {
                  console.log('获取字幕文件:', subtitle);
                  const subtitleResponse = await fetch(subtitle.subtitle_url);
                  const subtitleData = await subtitleResponse.json();
                  console.log('字幕文件内容:', subtitleData);

                  if (subtitleData.body && Array.isArray(subtitleData.body)) {
                    console.log('成功获取字幕数据，条数:', subtitleData.body.length);
                    this.processAiSubtitles(subtitleData);
                    return true;
                  }
                } catch (error) {
                  console.error('获取字幕文件失败:', error);
                }
              }
            }
          } else {
            console.log('播放器信息中没有字幕数据');
          }
        } else {
          console.log('获取播放器信息失败:', playerInfo.message);
        }
      } catch (error) {
        console.error('获取播放器信息异常:', error);
      }

      console.log('=== 所有字幕获取方法都失败了 ===');
      return false;
    } catch (error) {
      console.error('手动获取字幕总体失败:', error);
      return false;
    }
  }

  // 等待元素加载
  waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  async extractVideoInfo() {
    try {
      const titleElement = await this.waitForElement('.video-title, h1[title]');
      const title = titleElement?.textContent?.trim() || titleElement?.title || '';

      const descElement = document.querySelector('.desc-info-text, .desc-v2');
      const description = descElement?.textContent?.trim() || '';

      const uploaderElement = document.querySelector('.up-name, .username');
      const uploader = uploaderElement?.textContent?.trim() || '';

      const viewsElement = document.querySelector('.view, .play-count');
      const views = viewsElement?.textContent?.trim() || '';

      const likesElement = document.querySelector('.like, .like-count');
      const likes = likesElement?.textContent?.trim() || '';

      const durationElement = document.querySelector('.duration, .total-time');
      const duration = durationElement?.textContent?.trim() || '';

      const publishTimeElement = document.querySelector('.pubdate, .publish-time');
      const publishTime = publishTimeElement?.textContent?.trim() || '';

      return {
        title,
        description,
        uploader,
        views,
        likes,
        duration,
        publishTime,
        url: window.location.href
      };
    } catch (error) {
      console.error('Error extracting video info:', error);
      return null;
    }
  }

  async extractComments(limit = 20) {
    try {
      await this.waitForElement('.reply-list, .comment-list');
      
      const comments = [];
      const commentElements = document.querySelectorAll('.reply-item, .comment-item');
      
      for (let i = 0; i < Math.min(commentElements.length, limit); i++) {
        const element = commentElements[i];
        const userElement = element.querySelector('.user-name, .username');
        const contentElement = element.querySelector('.reply-content, .comment-content');
        const timeElement = element.querySelector('.reply-time, .comment-time');
        const likesElement = element.querySelector('.reply-btn .num, .like-count');

        if (contentElement) {
          comments.push({
            user: userElement?.textContent?.trim() || '',
            content: contentElement?.textContent?.trim() || '',
            time: timeElement?.textContent?.trim() || '',
            likes: likesElement?.textContent?.trim() || '0'
          });
        }
      }

      return comments;
    } catch (error) {
      console.error('Error extracting comments:', error);
      return [];
    }
  }

  async extractAllData() {
    if (this.isExtracted && this.videoData) {
      // 如果已经提取过，但可能有新的字幕数据，更新一下
      if (this.aiSubtitles.length > 0) {
        this.videoData.aiSubtitles = this.aiSubtitles;
        this.videoData.subtitleContent = this.getSubtitleText();
        this.videoData.formattedSubtitleContent = this.getFormattedSubtitleText();
      }
      return this.videoData;
    }

    try {
      console.log('开始提取Bilibili视频数据...');

      const videoInfo = await this.extractVideoInfo();
      if (!videoInfo) {
        throw new Error('无法提取视频基本信息');
      }

      const comments = await this.extractComments();

      // 如果还没有字幕数据，尝试手动获取
      if (this.aiSubtitles.length === 0) {
        console.log('没有通过网络拦截获取到字幕，尝试手动获取...');
        await this.tryFetchSubtitles();
      }

      this.videoData = {
        ...videoInfo,
        comments,
        aiSubtitles: this.aiSubtitles,
        subtitleContent: this.getSubtitleText(),
        formattedSubtitleContent: this.getFormattedSubtitleText(),
        extractedAt: new Date().toISOString()
      };

      this.isExtracted = true;
      console.log('视频数据提取完成:', this.videoData);
      console.log('字幕数据:', {
        count: this.aiSubtitles.length,
        hasContent: !!this.videoData.subtitleContent,
        contentLength: this.videoData.subtitleContent?.length || 0
      });

      return this.videoData;
    } catch (error) {
      console.error('提取视频数据失败:', error);
      return null;
    }
  }

  // 添加获取AI字幕的专门方法
  async waitForAiSubtitles(timeout = 10000) {
    return new Promise((resolve) => {
      if (this.aiSubtitles.length > 0) {
        resolve(this.aiSubtitles);
        return;
      }

      let timeoutId;
      const checkInterval = setInterval(() => {
        if (this.aiSubtitles.length > 0) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          resolve(this.aiSubtitles);
        }
      }, 500);

      timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        console.log('等待AI字幕超时，继续使用现有数据');
        resolve(this.aiSubtitles);
      }, timeout);
    });
  }
}

const extractor = new BilibiliContentExtractor();
// 将extractor暴露到全局作用域，供网络拦截使用
window.bilibiliExtractor = extractor;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);

  if (request.action === 'ping') {
    // 响应ping消息，确认content script已加载
    sendResponse({ success: true, message: 'Content script is ready' });
    return true;
  }

  if (request.action === 'extractVideoData') {
    // 先等待一下AI字幕数据，然后提取所有数据
    extractor.waitForAiSubtitles(5000)
      .then(() => extractor.extractAllData())
      .then(data => {
        console.log('Sending response with data:', data);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('Error in extractVideoData:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开放
  }

  if (request.action === 'tryFetchSubtitles') {
    // 手动尝试获取字幕
    extractor.tryFetchSubtitles()
      .then(success => {
        if (success) {
          sendResponse({
            success: true,
            count: extractor.aiSubtitles.length,
            message: '字幕获取成功'
          });
        } else {
          sendResponse({
            success: false,
            error: '未找到字幕数据'
          });
        }
      })
      .catch(error => {
        console.error('Error in tryFetchSubtitles:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'checkSubtitles') {
    // 检查字幕可用性
    try {
      const info = extractor.checkSubtitleAvailability();
      sendResponse({
        success: true,
        info: info
      });
    } catch (error) {
      console.error('Error in checkSubtitles:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 如果不是我们处理的消息，返回false
  return false;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      // 页面加载后等待一段时间让AI字幕请求完成
      extractor.waitForAiSubtitles(8000).then(() => {
        extractor.extractAllData();
      });
    }, 3000);
  });
} else {
  setTimeout(() => {
    extractor.waitForAiSubtitles(8000).then(() => {
      extractor.extractAllData();
    });
  }, 3000);
}

console.log('Bilibili AI Summary content script loaded');
