'use client'

import { Button } from '@/components/Button'
import { supabase } from '@/lib/supabase'

export function LoginButton() {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    })

    if (error) {
      console.error('Login error:', error)
    }
  }

  return (
    <Button 
      onClick={handleLogin}
      className="w-full"
    >
      Sign in with Google
    </Button>
  )
} 