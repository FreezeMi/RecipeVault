import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './components/AuthContext'
import { ToastProvider } from './components/Toast'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    {/* LazyMotion + `m` components ship only the animation features we use; reducedMotion honors the OS setting. */}
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
)
