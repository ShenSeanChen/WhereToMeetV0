'use client'

import { useState } from 'react'
import { Button } from './Button'
import toast from 'react-hot-toast'
import { ScheduleMeetingProps } from '@/types'

export function ScheduleMeeting({ venueName, venueAddress, onScheduled }: ScheduleMeetingProps) {
  const [date, setDate] = useState<string>('')
  const [time, setTime] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const handleSchedule = async () => {
    if (!date || !time) {
      toast.error('Please select both date and time')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `Meeting at ${venueName}`,
          location: venueAddress,
          startTime: `${date}T${time}:00`,
          endTime: `${date}T${time}:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to schedule meeting')
      }

      toast.success('Meeting scheduled successfully!')
      onScheduled()
    } catch (error) {
      toast.error('Failed to schedule meeting')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-white">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white dark:border-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-white">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white dark:border-gray-700"
          />
        </div>
      </div>
      <Button onClick={handleSchedule} disabled={loading} className="w-full">
        {loading ? 'Scheduling...' : 'Schedule Meeting'}
      </Button>
    </div>
  )
} 