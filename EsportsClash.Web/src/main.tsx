import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './AppRouter.tsx'
import { AccountProvider } from './AccountContext.tsx'
import './hexatrick-reference.css'
import './hexatrick-crimson.css'
import './hexatrick-world.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider><AppRouter /></AccountProvider>
  </StrictMode>,
)
