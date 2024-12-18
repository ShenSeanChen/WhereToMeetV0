'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LocationInput } from '@/components/LocationInput'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/Button'
import { supabase } from '@/lib/supabase'
import { Map } from '@/components/Map'
import { ScheduleMeeting } from '@/components/ScheduleMeeting'
import { VenueDetails } from '@/components/VenueDetails'
import { Meeting } from '@/types'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [userLocation, setUserLocation] = useState<google.maps.places.PlaceResult | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [recommendations, setRecommendations] = useState<google.maps.places.PlaceResult[]>([])
  const [showSchedule, setShowSchedule] = useState(false)

  useEffect(() => {
    console.log('Auth state:', { user, loading })
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (meeting?.id) {
      const channel = supabase
        .channel(`meeting_${meeting.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'WhereToMeetMeetings',
          filter: `id=eq.${meeting.id}`
        }, 
        (payload) => {
          const newMeeting = payload.new as Meeting
          setMeeting(newMeeting)
          if (newMeeting.participant_location && newMeeting.creator_location) {
            findMidpointVenues(newMeeting)
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [meeting?.id])

  const handleLocationSelect = async (location: google.maps.places.PlaceResult) => {
    setUserLocation(location)
    
    if (meeting?.id) {
      await supabase
        .from('WhereToMeetMeetings')
        .update({
          creator_location: {
            lat: location.geometry?.location?.lat(),
            lng: location.geometry?.location?.lng(),
            address: location.formatted_address
          }
        })
        .eq('id', meeting.id)
    }
  }

  const generateShareLink = async () => {
    if (!user || !userLocation) return

    const { data, error } = await supabase
      .from('WhereToMeetMeetings')
      .insert({
        creator_id: user.id,
        creator_location: {
          lat: userLocation.geometry?.location?.lat(),
          lng: userLocation.geometry?.location?.lng(),
          address: userLocation.formatted_address
        },
        status: 'pending'
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating meeting:', error)
      return
    }

    setMeeting(data)
    const link = `${window.location.origin}/join/${data.id}`
    setShareLink(link)
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

  const selectVenue = async (place: google.maps.places.PlaceResult) => {
    if (!meeting?.id) return

    await supabase
      .from('WhereToMeetMeetings')
      .update({
        chosen_location: {
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
          address: place.vicinity,
          name: place.name,
          place_id: place.place_id
        },
        status: 'completed'
      })
      .eq('id', meeting.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">
        {meeting?.status === 'completed' 
          ? 'Meeting Location' 
          : 'Set Your Location'}
      </h1>

      <div className="max-w-md mx-auto">
        <LocationInput 
          onLocationSelect={handleLocationSelect}
          placeholder="Search for your location"
        />
        
        {userLocation && (
          <div className="mt-4">
            <Button 
              onClick={generateShareLink}
              className="w-full"
            >
              {shareLink ? 'Copy Link' : 'Generate Sharing Link'}
            </Button>
          </div>
        )}

        {shareLink && (
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
            <p className="text-sm dark:text-white mb-2">Share this link with your friend:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 p-2 border rounded dark:bg-gray-700 dark:text-white"
              />
              <Button onClick={() => navigator.clipboard.writeText(shareLink)}>
                Copy
              </Button>
            </div>
          </div>
        )}
      </div>

      {meeting && (
        <div className="mt-8">
          <Map
            creatorLocation={meeting.creator_location}
            participantLocation={meeting.participant_location}
            chosenLocation={meeting.chosen_location}
            recommendations={meeting.status === 'active' ? recommendations : undefined}
          />
        </div>
      )}

      {recommendations.length > 0 && meeting?.status === 'active' && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.map((place) => (
            <div
              key={place.place_id}
              className="p-4 border rounded-lg dark:border-gray-700 hover:border-blue-500 cursor-pointer"
              onClick={() => selectVenue(place)}
            >
              <h3 className="font-bold dark:text-white">{place.name}</h3>
              <p className="text-sm dark:text-gray-300">{place.vicinity}</p>
              {place.rating && (
                <p className="text-sm dark:text-gray-300">Rating: {place.rating} ⭐</p>
              )}
            </div>
          ))}
        </div>
      )}

      {meeting && meeting.chosen_location && (
        <div className="mt-8 space-y-6">
          <div className="p-4 bg-green-100 dark:bg-green-900 rounded-md">
            <h2 className="text-xl font-bold mb-2 dark:text-white">Selected Venue</h2>
            <p className="dark:text-white">{meeting.chosen_location.name}</p>
            <p className="text-sm dark:text-gray-300">{meeting.chosen_location.address}</p>
            <div className="mt-4 flex gap-2">
              <Button 
                onClick={() => {
                  if (meeting.chosen_location) {
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${meeting.chosen_location.lat},${meeting.chosen_location.lng}`,
                      '_blank'
                    )
                  }
                }}
              >
                Open in Google Maps
              </Button>
              <Button 
                onClick={() => {
                  if (meeting.chosen_location) {
                    setShowSchedule(true)
                  }
                }}
              >
                Schedule Meeting
              </Button>
            </div>
          </div>

          {showSchedule && meeting.chosen_location && (
            <ScheduleMeeting
              venueName={meeting.chosen_location.name}
              venueAddress={meeting.chosen_location.address}
              onScheduled={() => setShowSchedule(false)}
            />
          )}

          {meeting.chosen_location.place_id && (
            <VenueDetails placeId={meeting.chosen_location.place_id} />
          )}
        </div>
      )}
    </div>
  )
} 