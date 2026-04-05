import { useParams } from 'react-router-dom'

export default function UserDetailPage() {
  const { id } = useParams()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">User Detail</h1>
      <p className="text-sm text-gray-500 mt-1">ID: {id}</p>
    </div>
  )
}
