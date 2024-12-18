'use client'

import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api'
import { useMemo } from 'react'
import { MapProps } from '@/types'

const libraries: ("places")[] = ['places']

export function Map({ creatorLocation, participantLocation, chosenLocation, recommendations }: MapProps) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries
  })

  const center = useMemo(() => {
    if (creatorLocation && participantLocation) {
      return {
        lat: (creatorLocation.lat + participantLocation.lat) / 2,
        lng: (creatorLocation.lng + participantLocation.lng) / 2
      }
    }
    return creatorLocation || { lat: 0, lng: 0 }
  }, [creatorLocation, participantLocation])

  if (!isLoaded) {
    return <div className="w-full h-[400px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
      <p className="dark:text-white">Loading map...</p>
    </div>
  }

  return (
    <GoogleMap
      zoom={13}
      center={center}
      mapContainerClassName="w-full h-[400px] rounded-lg"
      options={{
        styles: [
          {
            elementType: "geometry",
            stylers: [{ color: "#242f3e" }]
          },
          {
            elementType: "labels.text.stroke",
            stylers: [{ color: "#242f3e" }]
          },
          {
            elementType: "labels.text.fill",
            stylers: [{ color: "#746855" }]
          }
        ]
      }}
    >
      {creatorLocation && (
        <Marker
          position={{ lat: creatorLocation.lat, lng: creatorLocation.lng }}
          label="A"
        />
      )}
      {participantLocation && (
        <Marker
          position={{ lat: participantLocation.lat, lng: participantLocation.lng }}
          label="B"
        />
      )}
      {recommendations?.map((place) => (
        <Marker
          key={place.place_id}
          position={{
            lat: place.geometry?.location?.lat() || 0,
            lng: place.geometry?.location?.lng() || 0
          }}
          icon={{
            url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          }}
        />
      ))}
      {chosenLocation && (
        <Marker
          position={{ lat: chosenLocation.lat, lng: chosenLocation.lng }}
          icon={{
            url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
          }}
        />
      )}
    </GoogleMap>
  )
} 