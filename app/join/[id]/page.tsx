'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Meeting } from '@/types'
import { Map } from '@/components/Map'
import { LocationInput } from '@/components/LocationInput'
import { VenueDetails } from '@/components/VenueDetails'
import { Button } from '@/components/Button'
import { toast } from 'react-hot-toast'

export default function JoinMeeting() {
  const params = useParams()
  const id = params?.id as string
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<google.maps.places.PlaceResult | null>(null)
  const [recommendations, setRecommendations] = useState<google.maps.places.PlaceResult[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMeeting = async () => {
      if (!id) return

      try {
        const { data: meetings, error: queryError } = await supabase
          .from('WhereToMeetMeetings')
          .select('*')
          .eq('id', id)

        if (queryError) {
          console.error('Query error:', queryError)
          setError('Failed to fetch meeting')
          return
        }

        if (!meetings || meetings.length === 0) {
          console.error('No meeting found with ID:', id)
          setError('Meeting not found')
          return
        }

        const meetingData = meetings[0]
        console.log('Fetched meeting:', meetingData)
        setMeeting(meetingData)

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
            console.log('Meeting updated:', payload)
            const newMeeting = payload.new as Meeting
            setMeeting(newMeeting)
            if (newMeeting && newMeeting.status === 'active' && newMeeting.participant_location) {
              findMidpointVenues(newMeeting)
            }
            if (newMeeting.status === 'completed' && newMeeting.chosen_location) {
              toast.success('Meeting location has been chosen!')
            }
          })
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      } catch (err) {
        console.error('Error fetching meeting:', err)
        setError('Failed to fetch meeting. Please try again.')
      }
    }

    fetchMeeting()
  }, [id])

  const handleLocationSelect = (location: google.maps.places.PlaceResult) => {
    console.log('Location selected:', location)
    setSelectedLocation(location)
  }

  const handleSubmitLocation = async () => {
    if (!id || !meeting || !selectedLocation) return

    try {
      // Optimistically update the UI first
      const updatedMeeting = {
        ...meeting,
        participant_location: {
          lat: selectedLocation.geometry?.location?.lat() ?? 0,
          lng: selectedLocation.geometry?.location?.lng() ?? 0,
          address: selectedLocation.formatted_address ?? ''
        },
        status: 'active' as 'active' | 'pending' | 'completed'
      }
      setMeeting(updatedMeeting)

      const { error } = await supabase
        .from('WhereToMeetMeetings')
        .update({
          participant_location: {
            lat: selectedLocation.geometry?.location?.lat(),
            lng: selectedLocation.geometry?.location?.lng(),
            address: selectedLocation.formatted_address
          },
          status: 'active'
        })
        .eq('id', id)

      if (error) throw error

      setSelectedLocation(null)
      toast.success('Location submitted successfully!')
    } catch (err) {
      setMeeting(meeting)
      console.error('Error updating location:', err)
      setError('Failed to update location')
      toast.error('Failed to submit location')
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
          <p className="dark:text-white">
            Waiting for the creator to choose a meeting location
          </p>
        </div>
      )}

      {/* Location Input - only show if no location submitted yet */}
      {!meeting?.participant_location && (
        <div className="max-w-md mx-auto mb-8">
          <LocationInput
            onLocationSelect={handleLocationSelect}
            placeholder="Enter your location"
          />
          {selectedLocation && (
            <Button 
              onClick={handleSubmitLocation}
              className="w-full mt-4"
            >
              Confirm Location
            </Button>
          )}
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