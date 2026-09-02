import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { startServiceWorkerUpdates } from './lib/swUpdate'

// Tun mavzusi: saqlangan tanlov render'dan OLDIN qo'llanadi — sahifa ochilishida
// "oq miltillash" bo'lmasligi uchun. Standart — kun (hozirgi dizayn).
try {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch {
  /* localStorage yopiq bo'lsa — kun mavzusi */
}

// Ochiq sahifa yangi deploydan xabardor bo'lib tursin — resepsiya
// kompyuterida ilova kun bo'yi ochiq turadi va aks holda eski kod
// ekranda qolib ketardi
startServiceWorkerUpdates()

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
