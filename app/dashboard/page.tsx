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
// import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { toast } from 'react-hot-toast'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [userLocation, setUserLocation] = useState<google.maps.places.PlaceResult | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [recommendations, setRecommendations] = useState<google.maps.places.PlaceResult[]>([])
  const [showSchedule, setShowSchedule] = useState(false)
  const [venueStatuses, setVenueStatuses] = useState<Record<string, boolean>>({})
  const [isSearchingVenues, setIsSearchingVenues] = useState(false)

  useEffect(() => {
    console.log('Auth state:', { user, loading })
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchMeeting = async () => {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('WhereToMeetMeetings')
          .select('*')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (error) throw error
        console.log('Fetched meeting:', data)
        setMeeting(data)
        
        if (data && data.participant_location && data.creator_location) {
          findMidpointVenues(data)
        }
      } catch (err) {
        console.error('Error fetching meeting:', err)
      }
    }

    fetchMeeting()
  }, [user])

  useEffect(() => {
    if (meeting?.id) {
      console.log('Setting up real-time subscription for meeting:', meeting.id)
      
      const channel = supabase
        .channel(`meeting_${meeting.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'WhereToMeetMeetings',
          filter: `id=eq.${meeting.id}`
        }, 
        async (payload) => {
          console.log('Received real-time update:', payload)
          const newMeeting = payload.new as Meeting
          
          // Immediately update UI
          setMeeting(newMeeting)
          
          // Start searching if participant location is set
          if (newMeeting.status === 'active' && newMeeting.participant_location) {
            setIsSearchingVenues(true)
            console.log('Starting venue search from subscription...')
            await findMidpointVenues(newMeeting)
          }
        })
        .subscribe()

      return () => {
        console.log('Cleaning up subscription')
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
    
    setIsSearchingVenues(true)
    console.log('Starting venue search...')

    const midpoint = {
      lat: (meeting.creator_location.lat + meeting.participant_location.lat) / 2,
      lng: (meeting.creator_location.lng + meeting.participant_location.lng) / 2
    }

    if (!document.getElementById('map-service')) {
      const mapDiv = document.createElement('div')
      mapDiv.id = 'map-service'
      document.body.appendChild(mapDiv)
    }

    const mapServiceElement = document.getElementById('map-service') as HTMLDivElement
    const service = new google.maps.places.PlacesService(mapServiceElement)

    service.nearbySearch({
      location: midpoint,
      radius: 2000,
      type: 'restaurant',
      openNow: true
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        // Sort by rating after receiving results
        const sortedResults = results.sort((a, b) => (b.rating || 0) - (a.rating || 0))
        
        const simplifiedResults = sortedResults.slice(0, 9).map(place => ({
          place_id: place.place_id,
          name: place.name,
          vicinity: place.vicinity,
          rating: place.rating,
          user_ratings_total: place.user_ratings_total,
          geometry: place.geometry,
        }))
        
        console.log('Venues found:', simplifiedResults.length)
        setRecommendations(simplifiedResults)
      } else {
        console.error('Places API error:', status, midpoint)
        if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          service.nearbySearch({
            location: midpoint,
            radius: 5000,
            type: 'restaurant'
          }, (retryResults, retryStatus) => {
            if (retryStatus === google.maps.places.PlacesServiceStatus.OK && retryResults) {
              const simplifiedRetryResults = retryResults.slice(0, 9).map(place => ({
                place_id: place.place_id,
                name: place.name,
                vicinity: place.vicinity,
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                geometry: place.geometry,
              }))
              setRecommendations(simplifiedRetryResults)
            }
            setIsSearchingVenues(false)
          })
        } else {
          setIsSearchingVenues(false)
        }
      }
      setIsSearchingVenues(false)
    })
  }

  const selectVenue = async (place: google.maps.places.PlaceResult) => {
    if (!meeting?.id) return

    try {
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

      toast.success('Meeting location selected! You can now schedule the meeting.')
    } catch (error) {
      console.error('Error selecting venue:', error)
      toast.error('Failed to select meeting location')
    }
  }

  const getVenueOpenStatus = async (placeId: string): Promise<boolean | undefined> => {
    return new Promise((resolve) => {
      if (!placeId) {
        resolve(undefined)
        return
      }

      if (!document.getElementById('map-service')) {
        const mapDiv = document.createElement('div')
        mapDiv.id = 'map-service'
        document.body.appendChild(mapDiv)
      }
      // Creating a new PlacesService instance with a dynamically created HTMLDivElement
      const service = new google.maps.places.PlacesService(
        document.createElement('div') as HTMLDivElement
      )

      service.getDetails({
          placeId: placeId,
          fields: ['opening_hours']
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            resolve(place.opening_hours?.isOpen())
          } else {
            resolve(undefined)
          }
        }
      )
    })
  }

  useEffect(() => {
    const fetchOpenStatuses = async () => {
      const statuses: Record<string, boolean> = {}
      for (const place of recommendations) {
        if (place.place_id) {
          const isOpen = await getVenueOpenStatus(place.place_id)
          if (isOpen !== undefined) {
            statuses[place.place_id] = isOpen
          }
        }
      }
      setVenueStatuses(statuses)
    }

    if (recommendations.length > 0) {
      fetchOpenStatuses()
    }
  }, [recommendations])

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

        {meeting?.status === 'active' && meeting.participant_location && (
          <div className="mt-8 p-4 bg-blue-100 dark:bg-blue-900 rounded-md">
            <div className="flex items-center gap-2">
              <p className="dark:text-white">
                {isSearchingVenues 
                  ? 'Finding optimal meeting points...' 
                  : recommendations.length === 0 
                    ? 'User B has set their location. Starting search...'
                    : 'Choose a meeting location below'}
              </p>
              {isSearchingVenues && <LoadingSpinner />}
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

      {meeting?.status === 'active' && recommendations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4 dark:text-white">Choose a Meeting Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((place) => (
              <div
                key={place.place_id}
                className="p-4 border rounded-lg dark:border-gray-700 hover:border-blue-500 cursor-pointer transition-colors"
                onClick={() => selectVenue(place)}
              >
                <h3 className="font-bold dark:text-white">{place.name}</h3>
                <p className="text-sm dark:text-gray-300">{place.vicinity}</p>
                {place.rating && (
                  <div className="mt-2">
                    <span className="text-sm dark:text-gray-300">Rating: {place.rating} ⭐</span>
                    {place.user_ratings_total && (
                      <span className="text-sm dark:text-gray-400 ml-2">
                        ({place.user_ratings_total} reviews)
                      </span>
                    )}
                  </div>
                )}
                {place.place_id && venueStatuses[place.place_id] !== undefined && (
                  <p className="text-sm mt-2">
                    {venueStatuses[place.place_id] ? (
                      <span className="text-green-600 dark:text-green-400">Open now</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">Closed</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {meeting?.chosen_location && (
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
              <Button onClick={() => setShowSchedule(true)}>
                Schedule Meeting
              </Button>
            </div>
          </div>

          {showSchedule && meeting.chosen_location && (
            <ScheduleMeeting
              venueName={meeting.chosen_location.name}
              venueAddress={meeting.chosen_location.address}
              meetingId={meeting.id}
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