'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Meeting } from '@/types'
import { Map } from '@/components/Map'
import { LocationInput } from '@/components/LocationInput'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { VenueDetails } from '@/components/VenueDetails'
import { Button } from '@/components/Button'
import { useAuth } from '@/components/AuthProvider'

export default function JoinMeeting() {
  const params = useParams()
  const id = params?.id as string
  const { user } = useAuth()
  const router = useRouter()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [recommendations, setRecommendations] = useState<google.maps.places.PlaceResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push(`/auth?redirectTo=/join/${id}`)
    }
  }, [user, id, router])

  useEffect(() => {
    const fetchMeeting = async () => {
      if (!id || !user) return

      try {
        const { data, error } = await supabase
          .from('WhereToMeetMeetings')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        setMeeting(data)

        // Subscribe to meeting updates
        const channel = supabase
          .channel(`meeting_${id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'WhereToMeetMeetings',
            filter: `id=eq.${id}`
          }, 
          (payload) => {
            const newMeeting = payload.new as Meeting
            setMeeting(newMeeting)
            if (newMeeting && newMeeting.status === 'active' && newMeeting.participant_location) {
              findMidpointVenues(newMeeting)
            }
          })
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      } catch (err) {
        setError('Failed to fetch meeting')
      } finally {
        setLoading(false)
      }
    }

    fetchMeeting()
  }, [id, user])

  const handleLocationSelect = async (location: google.maps.places.PlaceResult) => {
    if (!user || !id || !meeting) return

    try {
      const { error } = await supabase
        .from('WhereToMeetMeetings')
        .update({
          participant_id: user.id,
          participant_location: {
            lat: location.geometry?.location?.lat(),
            lng: location.geometry?.location?.lng(),
            address: location.formatted_address
          },
          status: 'active'
        })
        .eq('id', id)

      if (error) throw error
    } catch (err) {
      setError('Failed to update location')
    }
  }

  const findMidpointVenues = async (meeting: Meeting) => {
    if (!meeting.creator_location || !meeting.participant_location) return

    const midpoint = {
      lat: (meeting.creator_location.lat + meeting.participant_location.lat) / 2,
      lng: (meeting.creator_location.lng + meeting.participant_location.lng) / 2
    }

    const service = new google.maps.places.PlacesService(
      document.createElement('div')
    )

    service.nearbySearch({
      location: midpoint,
      radius: 1000,
      type: 'restaurant'
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        setRecommendations(results)
      }
    })
  }

  return (
    <div className="container mx-auto px-4 py-8 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">
        {meeting?.status === 'completed' 
          ? 'Meeting Location' 
          : 'Join Meeting'}
      </h1>

      {/* Status Messages */}
      {meeting?.status === 'pending' && !meeting.participant_location && (
        <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-md">
          <p className="dark:text-white">Please set your location to continue</p>
        </div>
      )}

      {meeting?.status === 'active' && meeting.participant_location && (
        <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 rounded-md">
          <p className="dark:text-white">Waiting for the creator to choose a location</p>
        </div>
      )}

      {/* Location Input */}
      {meeting?.status !== 'completed' && !meeting?.participant_location && (
        <div className="max-w-md mx-auto mb-8">
          <LocationInput
            onLocationSelect={handleLocationSelect}
            placeholder="Enter your location"
          />
        </div>
      )}

      {/* Map */}
      {meeting && (
        <div className="mb-8">
          <Map
            creatorLocation={meeting.creator_location}
            participantLocation={meeting.participant_location}
            chosenLocation={meeting.chosen_location}
            recommendations={meeting.status === 'active' ? recommendations : undefined}
          />
        </div>
      )}

      {/* Chosen Location Details */}
      {meeting?.chosen_location && (
        <div className="mt-8 p-4 bg-green-100 dark:bg-green-900 rounded-md">
          <h2 className="text-xl font-bold mb-2 dark:text-white">Meeting Location</h2>
          <p className="dark:text-white">{meeting.chosen_location.name}</p>
          <p className="text-sm dark:text-gray-300">{meeting.chosen_location.address}</p>
          <Button 
            onClick={() => {
              if (meeting.chosen_location) {
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${meeting.chosen_location.lat},${meeting.chosen_location.lng}`,
                  '_blank'
                )
              }
            }}
            className="mt-4"
          >
            Open in Google Maps
          </Button>
          {meeting.chosen_location.place_id && (
            <div className="mt-4">
              <VenueDetails placeId={meeting.chosen_location.place_id} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="max-w-md mx-auto text-center">
          <p className="text-red-500 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
} 