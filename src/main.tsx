import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'

// Tun mavzusi: saqlangan tanlov render'dan OLDIN qo'llanadi — sahifa ochilishida
// "oq miltillash" bo'lmasligi uchun. Standart — kun (hozirgi dizayn).
try {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch {
  /* localStorage yopiq bo'lsa — kun mavzusi */
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
