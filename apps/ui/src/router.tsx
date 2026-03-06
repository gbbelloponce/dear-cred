import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import Login from '@/pages/Login'
import AppLayout from '@/components/AppLayout'
import Clientes from '@/pages/Clientes'
import ClienteNuevo from '@/pages/ClienteNuevo'
import ClienteDetalle from '@/pages/ClienteDetalle'
import PrestamoNuevo from '@/pages/PrestamoNuevo'
import Dashboard from '@/pages/Dashboard'

function AuthGuard() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/clientes" replace /> },
          { path: '/clientes', element: <Clientes /> },
          { path: '/clientes/nuevo', element: <ClienteNuevo /> },
          { path: '/clientes/:id', element: <ClienteDetalle /> },
          { path: '/clientes/:id/prestamo/nuevo', element: <PrestamoNuevo /> },
          { path: '/dashboard', element: <Dashboard /> },
        ],
      },
    ],
  },
])

export function Router() {
  return <RouterProvider router={router} />
}
