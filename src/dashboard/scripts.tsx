import { createRoot } from 'react-dom/client'
import { LibraryProvider } from '@shared/hooks/use-library'
import { App } from './App'
import './dashboard.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <LibraryProvider>
      <App />
    </LibraryProvider>,
  )
}