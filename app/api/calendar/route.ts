import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { meetingId, summary, location, startTime, endTime, timeZone } = body

    // Get participant email from the meeting
    const { data: meeting, error } = await supabase
      .from('WhereToMeetMeetings')
      .select('participant_email')
      .eq('id', meetingId)
      .single()

    if (error || !meeting?.participant_email) {
      return new NextResponse('Meeting not found', { status: 404 })
    }

    // Your Google Calendar API setup and authentication here
    // ... (implement Google Calendar API logic)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Calendar API error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 