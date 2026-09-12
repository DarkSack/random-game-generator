import { createRoot } from 'react-dom/client'
import { LibraryProvider } from '@shared/hooks/use-library'
import { PopupApp } from './PopupApp'
import './popup.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <LibraryProvider>
      <PopupApp />
    </LibraryProvider>,
  )
}