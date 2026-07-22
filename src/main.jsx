import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setupIonicReact } from '@ionic/react'
import '@ionic/react/css/core.css'
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'
import './shared/styles/od-compact-ui.css'
import './shared/overlay/od-overlay-stack.css'
import './shared/styles/wiki-editor.css'
import './index.css'
import App from './App.jsx'

setupIonicReact();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
