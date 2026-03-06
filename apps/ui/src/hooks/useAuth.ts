import { useEffect, useState } from 'react'

const TOKEN_KEY = 'token'
const API_URL = import.meta.env.VITE_API_URL as string

type SignInError = { type: 'auth' | 'server' }

export function useAuth() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY))
    setLoading(false)
  }, [])

  async function signIn(email: string, password: string): Promise<{ error: SignInError | null }> {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.status === 401) return { error: { type: 'auth' } }
      if (!res.ok) return { error: { type: 'server' } }
      const { accessToken } = await res.json()
      localStorage.setItem(TOKEN_KEY, accessToken)
      setToken(accessToken)
      return { error: null }
    } catch {
      return { error: { type: 'server' } }
    }
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }

  return { session: token, loading, signIn, signOut }
}
