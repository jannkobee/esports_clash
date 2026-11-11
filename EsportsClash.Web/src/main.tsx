import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './AppRouter.tsx'
import { AccountProvider } from './AccountContext.tsx'
import './hexatrick-reference.css'
import './hexatrick-crimson.css'
import './hexatrick-world.css'
import {PersonalThemeProvider} from './PersonalThemeContext'
import {GameModesProvider} from './gameModes'
import './personal-theme.css'
import './hexatrick-records.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider><PersonalThemeProvider><GameModesProvider><AppRouter /></GameModesProvider></PersonalThemeProvider></AccountProvider>
  </StrictMode>,
)
