import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import GarcomMobileApp from './GarcomMobileApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GarcomMobileApp />
  </StrictMode>,
)
