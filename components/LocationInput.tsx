'use client'

import { useLoadScript, Autocomplete } from '@react-google-maps/api'
import { useState } from 'react'
import { LocationInputProps } from '@/types'

// Define libraries array outside component to prevent recreation
const libraries: ("places")[] = ['places']

export function LocationInput({ onLocationSelect, placeholder }: LocationInputProps) {
  const [searchBox, setSearchBox] = useState<google.maps.places.Autocomplete | null>(null)

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries
  })

  if (!isLoaded) return <div className="dark:text-white">Loading...</div>

  return (
    <Autocomplete
      onLoad={autocomplete => setSearchBox(autocomplete)}
      onPlaceChanged={() => {
        if (searchBox) {
          const place = searchBox.getPlace()
          onLocationSelect(place)
        }
      }}
    >
      <input
        type="text"
        placeholder={placeholder || "Enter location"}
        className="w-full p-2 border rounded-md dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:placeholder-gray-400"
      />
    </Autocomplete>
  )
} 