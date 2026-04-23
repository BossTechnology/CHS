import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './chs-app.jsx'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.2,
  replaysOnErrorSampleRate: 1.0,
})

createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={
    <div style={{ fontFamily: 'monospace', padding: 40, textAlign: 'center' }}>
      <p style={{ fontSize: 14, color: '#666' }}>Something went wrong. Please refresh the page.</p>
    </div>
  }>
    <App />
    <Analytics />
    <SpeedInsights />
  </Sentry.ErrorBoundary>
)
