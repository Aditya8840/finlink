import { NavLink, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-700">
          <h1 className="text-lg font-bold tracking-tight">FinLink</h1>
          <p className="text-xs text-gray-400 mt-0.5">Finance Link Analyzer</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          <SidebarLink to="/users" label="Users" />
          <SidebarLink to="/transactions" label="Transactions" />
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}

function SidebarLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded text-sm transition-colors ${
          isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
