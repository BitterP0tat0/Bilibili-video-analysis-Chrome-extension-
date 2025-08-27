import { useState, useEffect } from 'react'
import { Brain, Settings, History, Loader2, AlertCircle} from 'lucide-react'
import './App.css'

interface VideoData {
  title: string;
  description: string;
  uploader: string;
  views: string;
  likes: string;
  duration: string;
  publishTime: string;
  url: string;
  comments: Array<{
    user: string;
    content: string;
    time: string;
    likes: string;
  }>;
  aiSubtitles?: Array<{
    from: number;
    to: number;
    sid: number;
    location: number;
    content: string;
    music: number;
  }>;
  subtitleContent?: string;
  formattedSubtitleContent?: string;
}

interface SummaryRecord {
  id: string;
  videoUrl: string;
  videoTitle: string;
  uploader: string;
  summary: string;
  createdAt: string;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<'summary' | 'settings' | 'history'>('summary')
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [summary, setSummary] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [apiKey, setApiKey] = useState('')
  const [apiProvider, setApiProvider] = useState('openai')
  const [summaryHistory, setSummaryHistory] = useState<SummaryRecord[]>([])

  const [isBilibiliPage, setIsBilibiliPage] = useState(false)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      const currentTab = tabs[0]
      if (currentTab?.url?.includes('bilibili.com/video/')) {
        setIsBilibiliPage(true)
        ensureContentScriptLoaded(currentTab.id!)
        restorePageState(currentTab.url!)
      }
    })

    loadSettings()
    loadSummaryHistory()
  }, [])

  const savePageState = async (url: string, data: any) => {
    try {
      const stateKey = `pageState_${url}`
      await chrome.storage.local.set({ [stateKey]: data })
    } catch (error) {
      console.error('保存页面状态失败:', error)
    }
  }

  const restorePageState = async (url: string) => {
    try {
      const stateKey = `pageState_${url}`
      const result = await chrome.storage.local.get([stateKey])
      const savedState = result[stateKey]

      if (savedState) {
        console.log('恢复页面状态:', savedState)
        if (savedState.videoData) setVideoData(savedState.videoData)
        if (savedState.summary) setSummary(savedState.summary)
        if (savedState.currentTab) setCurrentTab(savedState.currentTab)
      }
    } catch (error) {
      console.error('恢复页面状态失败:', error)
    }
  }

  const ensureContentScriptLoaded = async (tabId: number) => {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'ping' })
    } catch (error) {
      console.log('Content script not loaded, injecting...')
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        })
        console.log('Content script injected successfully')
      } catch (injectError) {
        console.error('Failed to inject content script:', injectError)
      }
    }
  }

  const loadSettings = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' })
      if (response.success) {
        setApiKey(response.settings.apiKey || '')
        setApiProvider(response.settings.apiProvider || 'openai')
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  }

  const saveSettings = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        apiKey,
        apiProvider
      })
      if (response.success) {
        setError('')
        alert('设置保存成功！')
      } else {
        setError(response.error || '保存设置失败')
      }
    } catch (error) {
      setError('保存设置失败')
    }
  }

  const loadSummaryHistory = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSummaryHistory' })
      if (response.success) {
        setSummaryHistory(response.history)
      }
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  }

  const extractVideoData = async () => {
    try {
      setIsLoading(true)
      setError('')

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab.id) {
        throw new Error('无法获取当前标签页ID')
      }

      console.log('Sending message to tab:', tab.id)

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractVideoData'
      })

      console.log('Received response:', response)

      if (response && response.success) {
        setVideoData(response.data)
        // 保存状态
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab.url) {
          savePageState(tab.url, {
            videoData: response.data,
            summary,
            currentTab
          })
        }
        return response.data
      } else {
        throw new Error(response?.error || '提取视频数据失败')
      }
    } catch (error) {
      console.error('Extract video data error:', error)

      // 检查是否是连接错误
      if (error instanceof Error && error.message.includes('Receiving end does not exist')) {
        setError('请确保您在Bilibili视频页面，并刷新页面后重试')
      } else {
        setError(error instanceof Error ? error.message : '提取视频数据失败')
      }
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const generateSummary = async () => {
    if (!apiKey) {
      setError('请先在设置中配置API密钥')
      return
    }

    try {
      setIsLoading(true)
      setError('')
      setSummary('')

      let data = videoData
      if (!data) {
        data = await extractVideoData()
        if (!data) return
      }

      const response = await chrome.runtime.sendMessage({
        action: 'generateSummary',
        videoData: data
      })

      if (response.success) {
        setSummary(response.summary)
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab.url) {
          savePageState(tab.url, {
            videoData: data,
            summary: response.summary,
            currentTab
          })
        }
        loadSummaryHistory()
      } else {
        throw new Error(response.error || '生成总结失败')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '生成总结失败')
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <Brain className="header-icon" />
          <h1>B站总结</h1>
        </div>
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${currentTab === 'summary' ? 'active' : ''}`}
            onClick={() => setCurrentTab('summary')}
          >
            总结
          </button>
          <button
            className={`nav-tab ${currentTab === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentTab('settings')}
          >
            <Settings size={16} />
            设置
          </button>
          <button
            className={`nav-tab ${currentTab === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentTab('history')}
          >
            <History size={16} />
            历史
          </button>
   
        </nav>
      </header>

      <main className="app-main">
        {currentTab === 'summary' && (
          <SummaryTab
            isBilibiliPage={isBilibiliPage}
            videoData={videoData}
            summary={summary}
            isLoading={isLoading}
            error={error}
            onExtractData={extractVideoData}
            onGenerateSummary={generateSummary}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsTab
            apiKey={apiKey}
            apiProvider={apiProvider}
            onApiKeyChange={setApiKey}
            onApiProviderChange={setApiProvider}
            onSave={saveSettings}
            error={error}
          />
        )}

        {currentTab === 'history' && (
          <HistoryTab
            history={summaryHistory}
            onRefresh={loadSummaryHistory}
          />
        )}
      </main>
    </div>
  )
}

interface SummaryTabProps {
  isBilibiliPage: boolean;
  videoData: VideoData | null;
  summary: string;
  isLoading: boolean;
  error: string;
  onExtractData: () => Promise<VideoData | null>;
  onGenerateSummary: () => Promise<void>;
}

function SummaryTab({
  isBilibiliPage,
  videoData,
  summary,
  isLoading,
  error,
  onExtractData,
  onGenerateSummary
}: SummaryTabProps) {
  if (!isBilibiliPage) {
    return (
      <div className="not-bilibili">
        <AlertCircle className="warning-icon" />
        <h3>请在Bilibili视频页面使用此工具</h3>
        <p>当前页面不是Bilibili视频页面，请导航到任意Bilibili视频页面后再使用。</p>
        <div className="open-in-tab-hint">
          <button
            className="btn btn-primary"
            onClick={() => {
              chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })
            }}
          >
            在新标签页中打开扩展
          </button>
          <small>在新标签页中打开可避免popup自动关闭</small>
        </div>
      </div>
    )
  }

  return (
    <div className="summary-tab">
      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          {error}
          {error.includes('刷新页面') && (
            <div className="error-help">
              <p>可能的解决方案：</p>
              <ul>
                <li>刷新当前Bilibili视频页面</li>
                <li>确保您在 bilibili.com/video/ 页面</li>
                <li>重新加载扩展程序</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <Loader2 className="spinning" size={24} />
            <p>正在处理中，请保持页面打开...</p>
          </div>
        </div>
      )}

      {videoData && (
        <div className="video-info">
          <h3>{videoData.title}</h3>
          <div className="video-meta">
            <span>UP主: {videoData.uploader}</span>
            <span>时长: {videoData.duration}</span>
            <span>播放: {videoData.views}</span>
            <span>点赞: {videoData.likes}</span>
          </div>
          {videoData.aiSubtitles && videoData.aiSubtitles.length > 0 && (
            <div className="subtitle-info">
              <span className="subtitle-badge">✓ 已获取AI字幕 ({videoData.aiSubtitles.length}条)</span>
            </div>
          )}
          {videoData.subtitleContent && (
            <div className="subtitle-preview">
              <details className="subtitle-details">
                <summary className="subtitle-summary">📝 完整字幕内容 ({videoData.aiSubtitles?.length || 0}条，共{videoData.subtitleContent.length}字符)</summary>
                <div className="subtitle-content-wrapper">
                  <div className="subtitle-actions">
                    <button
                      className="copy-subtitle-btn"
                      onClick={(e) => {
                        const textToCopy = videoData.formattedSubtitleContent || videoData.subtitleContent;
                        navigator.clipboard.writeText(textToCopy || '').then(() => {
                          const btn = e.target as HTMLButtonElement;
                          const originalText = btn.textContent;
                          btn.textContent = '✅ 已复制';
                          setTimeout(() => {
                            btn.textContent = originalText;
                          }, 2000);
                        }).catch(() => {
                          alert('复制失败，请手动选择文本复制');
                        });
                      }}
                    >
                      📋 复制字幕
                    </button>
                  </div>
                  <div className="full-subtitle-content">
                    {videoData.formattedSubtitleContent || videoData.subtitleContent}
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      <div className="action-buttons">
        <button
          className="btn btn-secondary"
          onClick={onExtractData}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="spinning" size={16} /> : null}
          提取视频数据
        </button>


        <button
          className="btn btn-primary"
          onClick={onGenerateSummary}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="spinning" size={16} /> : <Brain size={16} />}
          生成AI总结
        </button>
      </div>

      {summary && (
        <div className="summary-result">
          <div className="summary-header">
            <h4>AI总结结果</h4>
          </div>

          {videoData?.subtitleContent && (
            <div className="full-subtitle-section">
              <details className="subtitle-details">
                <summary className="subtitle-summary">
                  完整字幕内容 ({videoData.aiSubtitles?.length || 0}条)
                </summary>
                <div className="subtitle-content-wrapper">
                  <div className="subtitle-actions">
                    <button
                      className="copy-subtitle-btn"
                      onClick={() => {
                        const textToCopy = videoData.formattedSubtitleContent || videoData.subtitleContent;
                        navigator.clipboard.writeText(textToCopy || '').then(() => {
                          console.log('字幕已复制到剪贴板');
                        });
                      }}
                    >
                      复制字幕
                    </button>
                  </div>
                  <div className="full-subtitle-content">
                    {videoData.formattedSubtitleContent || videoData.subtitleContent}
                  </div>
                </div>
              </details>
            </div>
          )}

          {/* AI总结内容 */}
          <div className="ai-summary-section">
            <h5 className="section-title">AI智能总结</h5>
            <div className="summary-content">
              {summary.split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface SettingsTabProps {
  apiKey: string;
  apiProvider: string;
  onApiKeyChange: (key: string) => void;
  onApiProviderChange: (provider: string) => void;
  onSave: () => void;
  error: string;
}

function SettingsTab({
  apiKey,
  apiProvider,
  onApiKeyChange,
  onApiProviderChange,
  onSave,
  error
}: SettingsTabProps) {
  return (
    <div className="settings-tab">
      <h3>API设置</h3>

      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="apiProvider">AI服务提供商</label>
        <select
          id="apiProvider"
          value={apiProvider}
          onChange={(e) => onApiProviderChange(e.target.value)}
          className="form-control"
        >
          <option value="openai">OpenAI</option>
          <option value="kksjapi">KKSJ API</option>
          <option value="claude" disabled>Claude (即将支持)</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="apiKey">API密钥</label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="请输入您的API密钥"
          className="form-control"
        />
        <small className="form-help">
          您的API密钥将安全地存储在本地，不会上传到任何服务器
        </small>
      </div>

      <button className="btn btn-primary" onClick={onSave}>
        保存设置
      </button>

      <div className="settings-info">
        <h4>使用说明</h4>
        <ul>
          <li><strong>OpenAI</strong>: 支持GPT-3.5-turbo模型，需要OpenAI API密钥</li>
          <li><strong>KKSJ API</strong>: 支持多种AI模型，需要KKSJ API密钥</li>
          <li>API密钥仅存储在您的浏览器本地，不会上传到任何服务器</li>
          <li>每次总结会消耗少量API费用，具体费用取决于所选服务</li>
        </ul>

        {apiProvider === 'kksjapi' && (
          <div className="provider-specific-info">
            <h5>KKSJ API 配置说明</h5>
            <ul>
              <li>请在API密钥字段输入您的KKSJ API密钥</li>
              <li>支持多种AI模型，默认使用GPT-3.5-turbo</li>
              <li>访问 <a href="https://kksjapi.com" target="_blank" rel="noopener noreferrer">kksjapi.com</a> 获取API密钥</li>
            </ul>
          </div>
        )}

        {apiProvider === 'openai' && (
          <div className="provider-specific-info">
            <h5>OpenAI 配置说明</h5>
            <ul>
              <li>请在API密钥字段输入您的OpenAI API密钥</li>
              <li>访问 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI平台</a> 获取API密钥</li>
              <li>每次总结大约消耗0.001-0.01美元的API费用</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

interface HistoryTabProps {
  history: SummaryRecord[];
  onRefresh: () => void;
}

function HistoryTab({ history, onRefresh }: HistoryTabProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const openVideo = (url: string) => {
    chrome.tabs.create({ url })
  }

  return (
    <div className="history-tab">
      <div className="history-header">
        <h3>总结历史</h3>
        <button className="btn btn-secondary" onClick={onRefresh}>
          刷新
        </button>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <History className="empty-icon" />
          <p>暂无总结历史</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((record) => (
            <div key={record.id} className="history-item">
              <div className="history-item-header">
                <h4
                  className="history-title"
                  onClick={() => openVideo(record.videoUrl)}
                  title="点击打开视频"
                >
                  {record.videoTitle}
                </h4>
                <span className="history-date">
                  {formatDate(record.createdAt)}
                </span>
              </div>
              <div className="history-meta">
                <span>UP主: {record.uploader}</span>
              </div>
              <div className="history-summary">
                {record.summary.split('\n').slice(0, 3).map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
