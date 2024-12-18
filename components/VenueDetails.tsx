'use client'

import { useState, useEffect } from 'react'
import { LoadingSpinner } from './LoadingSpinner'
import Image from 'next/image'
import { VenueDetail, VenueDetailsProps } from '@/types'

export function VenueDetails({ placeId }: VenueDetailsProps) {
  const [details, setDetails] = useState<VenueDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDetails = () => {
      const service = new google.maps.places.PlacesService(
        document.createElement('div')
      )

      service.getDetails(
        {
          placeId: placeId,
          fields: ['name', 'rating', 'photos', 'opening_hours', 'formatted_phone_number', 'website', 'price_level']
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            setDetails({
              name: place.name || '',
              rating: place.rating || 0,
              photos: place.photos?.slice(0, 3).map(photo => photo.getUrl()) || [],
              openingHours: place.opening_hours?.weekday_text || [],
              phoneNumber: place.formatted_phone_number,
              website: place.website,
              priceLevel: place.price_level
            })
          }
          setLoading(false)
        }
      )
    }

    fetchDetails()
  }, [placeId])

  if (loading) return <LoadingSpinner />
  if (!details) return null

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-xl font-bold mb-4 dark:text-white">{details.name}</h3>
      
      <div className="grid grid-cols-3 gap-2 mb-4">
        {details.photos.map((photo, index) => (
          <div key={index} className="relative h-24">
            <Image
              src={photo}
              alt={`${details.name} photo ${index + 1}`}
              fill
              className="object-cover rounded"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="dark:text-white">
          Rating: {details.rating} ⭐
          {details.priceLevel && ` • Price: ${'$'.repeat(details.priceLevel)}`}
        </p>
        
        {details.phoneNumber && (
          <p className="dark:text-gray-300">
            📞 <a href={`tel:${details.phoneNumber}`}>{details.phoneNumber}</a>
          </p>
        )}
        
        {details.website && (
          <p className="dark:text-gray-300">
            🌐 <a href={details.website} target="_blank" rel="noopener noreferrer" className="text-blue-500">Website</a>
          </p>
        )}

        <div className="mt-4">
          <h4 className="font-medium mb-2 dark:text-white">Opening Hours</h4>
          <ul className="text-sm space-y-1 dark:text-gray-300">
            {details.openingHours.map((hours, index) => (
              <li key={index}>{hours}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
} 