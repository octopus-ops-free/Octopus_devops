import { useMemo, useState } from 'react'

const DEFAULT_AI_AGENT_URL = 'http://127.0.0.1:8501'
const AI_AGENT_URL_STORAGE_KEY = 'octopus.aiAgentUrl'

export function AiPage() {
  const initialUrl = useMemo(() => {
    try {
      return localStorage.getItem(AI_AGENT_URL_STORAGE_KEY) || DEFAULT_AI_AGENT_URL
    } catch {
      return DEFAULT_AI_AGENT_URL
    }
  }, [])

  const [aiAgentUrl, setAiAgentUrl] = useState<string>(initialUrl)

  function openAiAssistant() {
    const url = aiAgentUrl.trim() || DEFAULT_AI_AGENT_URL
    try {
      localStorage.setItem(AI_AGENT_URL_STORAGE_KEY, url)
    } catch {
      // ignore
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>AI</h1>
      <div style={{ color: 'var(--text-soft)', marginBottom: 12 }}>
        打开外部智能体页面（legacy openAiAssistant）
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={label}>
            智能体 URL
            <input
              value={aiAgentUrl}
              onChange={(e) => setAiAgentUrl(e.target.value)}
              style={{ ...input, width: 420, maxWidth: '100%' }}
              placeholder={DEFAULT_AI_AGENT_URL}
              aria-label="aiAgentUrl"
            />
          </label>

          <button onClick={openAiAssistant} style={button}>
            打开智能体
          </button>
        </div>
      </div>
    </div>
  )
}

const label: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 12,
  color: 'var(--text-soft)',
}

const input: React.CSSProperties = {
  padding: '10px 10px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  fontSize: 13,
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
}

const button: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  background: 'var(--shell-surface-raised)',
  color: 'var(--heading)',
  fontWeight: 800,
  cursor: 'pointer',
}

const card: React.CSSProperties = {
  padding: 12,
  border: '1px solid var(--shell-border-medium)',
  borderRadius: 12,
  background: 'var(--shell-surface)',
}
