import UserManagementPage from '@/presentation/components/admin/UserManagementPage'
import DataResetSection from '@/presentation/components/settings/DataResetSection'

export default function Page() {
  return (
    <div className="space-y-8">
      <UserManagementPage />
      <DataResetSection />
    </div>
  )
}
