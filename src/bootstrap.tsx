import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { startServiceWorkerUpdates } from './lib/swUpdate'

// Ilovaning o'zi. main.tsx bu modulni til lug'ati yuklangandan KEYIN import
// qiladi: sahifalar va konstantalardagi tr("...") lar modul yuklanishida
// hisoblanadi va o'sha paytda til allaqachon ma'lum bo'lishi kerak.

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
