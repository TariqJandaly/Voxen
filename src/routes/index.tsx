import { createFileRoute } from '@tanstack/react-router'
import { Viewport } from '../components/Viewport'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <Viewport />
    </div>
  )
}
