import { Link, Outlet, useNavigate } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Logout01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

export default function AppLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold">Dear Cred</span>
            <nav className="flex gap-4">
              <Link
                to="/clientes"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clientes
              </Link>
              <Link
                to="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <HugeiconsIcon icon={Logout01Icon} size={16} strokeWidth={2} />
            Salir
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
