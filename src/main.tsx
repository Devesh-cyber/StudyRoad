import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/authContext'
import { ShellLayout } from '@/components/ShellLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { NewRoadmapPage } from '@/pages/NewRoadmapPage'
import { RoadmapPage } from '@/pages/RoadmapPage'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

const rootElement = document.getElementById('root') || document.getElementById('app')

ReactDOM.createRoot(rootElement!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ShellLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/new" element={<NewRoadmapPage />} />
              <Route path="/r/:id" element={<RoadmapPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ShellLayout>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
