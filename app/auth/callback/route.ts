import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const redirectTo = requestUrl.searchParams.get('redirectTo')
    console.log('Auth callback received:', { code, redirectTo, url: request.url })

    if (!code) {
      console.log('No code found, redirecting to home')
      return NextResponse.redirect(new URL('/', request.url))
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth error:', error)
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (data.session) {
      console.log('Session established, redirecting to:', redirectTo || '/dashboard')
      return NextResponse.redirect(new URL(redirectTo || '/dashboard', request.url))
    }

    return NextResponse.redirect(new URL('/', request.url))
  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
} 