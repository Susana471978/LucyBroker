import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'
import App from '@/App'
import { registerSW } from './registerSW'

registerSW()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
