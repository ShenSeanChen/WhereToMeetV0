'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginButton } from '@/components/LoginButton'
import { useAuth } from '@/components/AuthProvider'

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && user) {
      console.log('User authenticated, redirecting to dashboard')
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen dark:bg-black-900">
      <main className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 dark:text-white">WhereToMeet</h1>
          <p className="text-lg text-black-700 dark:text-black-200">
            Find the perfect meeting spot between two locations
          </p>
        </header>
        
        <section className="max-w-md mx-auto">
          <LoginButton />
        </section>
      </main>
    </div>
  )
}
