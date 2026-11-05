import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/authContext'
import { ToastProvider } from '@/lib/toast'
import { ShellLayout } from '@/components/ShellLayout'
import { TodayPage } from '@/pages/TodayPage'
import { NewRoadmapPage } from '@/pages/NewRoadmapPage'
import { RoadmapPage } from '@/pages/RoadmapPage'
import './index.css'

// Deliver cache updates synchronously (default is a 0ms timer). The outline editor
// updates the cache optimistically and then moves keyboard focus to the new row;
// with the timer, the first keystrokes after Enter landed in the previous item.
notifyManager.setScheduler((cb) => cb())

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

const rootElement = document.getElementById('root') || document.getElementById('app')

ReactDOM.createRoot(rootElement!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <ShellLayout>
            <Routes>
              <Route path="/" element={<TodayPage />} />
              <Route path="/new" element={<NewRoadmapPage />} />
              <Route path="/r/:id" element={<RoadmapPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ShellLayout>
        </BrowserRouter>
      </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
