'use client'

export default function Error() {
  return (
    <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4 dark:text-red-400">Error loading meeting</h2>
        <p className="text-gray-600 dark:text-gray-400">Please check the meeting link and try again</p>
      </div>
    </div>
  )
} 