import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { captureTokenFromUrl } from './auth/token'

// Before the first render, so the token is stored and gone from the address bar
// before the app checks its session.
captureTokenFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
