import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { CalendarEventRequest } from '@/types'

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body: CalendarEventRequest = await request.json()
    const { summary, location, startTime, endTime, timeZone } = body

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`
    )

    oauth2Client.setCredentials({
      access_token: session.provider_token,
      refresh_token: session.provider_refresh_token
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        location,
        description: 'Meeting scheduled via WhereToMeet',
        start: {
          dateTime: startTime,
          timeZone
        },
        end: {
          dateTime: endTime,
          timeZone
        },
        attendees: session.user?.email ? [{ email: session.user.email }] : undefined,
        reminders: {
          useDefault: true
        }
      }
    })

    return NextResponse.json({ success: true, eventId: event.data.id })
  } catch (error) {
    console.error('Calendar API Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 