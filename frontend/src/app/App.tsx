import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type DbHealth = { ok: boolean; detail?: string }

export function App() {
  const [status, setStatus] = useState<string>('loading...')

  useEffect(() => {
    api<DbHealth>('/api/db/health')
      .then((d) => {
        if (d.ok) {
          setStatus('backend ok')
          return
        }
        setStatus('backend not ok: ' + (d.detail ?? ''))
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e)
        setStatus('backend error: ' + message)
      })
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <h1>Octopus Ops</h1>
      <div>{status}</div>
    </div>
  )
}