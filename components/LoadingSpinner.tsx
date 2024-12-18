interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
}

export function LoadingSpinner({ size = 'medium' }: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  }

  return (
    <div className={`animate-spin ${sizeClasses[size]}`}>
      <div className="border-4 border-blue-500 border-t-transparent rounded-full w-full h-full" />
    </div>
  )
} 