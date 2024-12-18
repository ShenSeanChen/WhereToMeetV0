export interface Location {
  lat: number
  lng: number
  address: string
}

export interface Meeting {
  id: string
  creator_id: string
  participant_id?: string
  creator_location?: {
    lat: number
    lng: number
    address: string
  }
  participant_location?: {
    lat: number
    lng: number
    address: string
  }
  chosen_location?: {
    lat: number
    lng: number
    address: string
    name: string
    place_id: string
  }
  status: 'pending' | 'active' | 'completed'
  created_at: string
}

export interface VenueDetail {
  name: string
  rating: number
  photos: string[]
  openingHours: string[]
  phoneNumber?: string
  website?: string
  priceLevel?: number
}

export interface ScheduleMeetingProps {
  venueName: string
  venueAddress: string
  onScheduled: () => void
}

export interface VenueDetailsProps {
  placeId: string
}

export interface MapProps {
  creatorLocation?: Location
  participantLocation?: Location
  chosenLocation?: Location & { name: string }
  recommendations?: google.maps.places.PlaceResult[]
}

export interface LocationInputProps {
  onLocationSelect: (location: google.maps.places.PlaceResult) => void
  placeholder?: string
}

export interface CalendarEventRequest {
  summary: string
  location: string
  startTime: string
  endTime: string
  timeZone: string
} 