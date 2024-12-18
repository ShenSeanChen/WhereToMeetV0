'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoginButton } from '@/components/LoginButton'
import { useAuth } from '@/components/AuthProvider'

export default function Auth() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')

  useEffect(() => {
    if (!loading && user) {
      router.push(redirectTo || '/dashboard')
    }
  }, [user, loading, router, redirectTo])

  return (
    <div className="min-h-screen dark:bg-black-900">
      <main className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 dark:text-white">Sign In Required</h1>
          <p className="text-lg text-black-700 dark:text-black-200">
            Please sign in to continue
          </p>
        </header>
        
        <section className="max-w-md mx-auto">
          <LoginButton />
        </section>
      </main>
    </div>
  )
} 