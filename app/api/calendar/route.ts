import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabase } from '@/lib/supabase'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
)

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
})

const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { meetingId, summary, location, startTime, endTime, timeZone } = body

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      console.error('Missing Google Calendar credentials')
      return new NextResponse('Server configuration error', { status: 500 })
    }

    // Get participant email from the meeting
    const { data: meeting, error } = await supabase
      .from('WhereToMeetMeetings')
      .select('participant_email, creator_id')
      .eq('id', meetingId)
      .single()

    if (error || !meeting?.participant_email) {
      console.error('Meeting fetch error:', error)
      return new NextResponse('Meeting not found', { status: 404 })
    }

    const event = {
      summary,
      location,
      description: 'Meeting scheduled via WhereToMeet',
      start: {
        dateTime: startTime,
        timeZone,
      },
      end: {
        dateTime: endTime,
        timeZone,
      },
      attendees: [
        { email: meeting.participant_email }
      ],
    }

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'all',
      })
      console.log('Calendar event created:', response.data)
      return NextResponse.json({ success: true, eventId: response.data.id })
    } catch (calendarError) {
      console.error('Google Calendar API error:', calendarError)
      return new NextResponse('Failed to create calendar event', { status: 500 })
    }
  } catch (error) {
    console.error('Calendar API error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 