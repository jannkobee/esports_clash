import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GameContentProvider } from './GameContentContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameContentProvider><App /></GameContentProvider>
  </StrictMode>,
)
