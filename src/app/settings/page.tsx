import UserManagementPage from '@/presentation/components/admin/UserManagementPage'
import NotificationRecipientsSection from '@/presentation/components/settings/NotificationRecipientsSection'
import DataResetSection from '@/presentation/components/settings/DataResetSection'

export default function Page() {
  return (
    <div className="space-y-8">
      <UserManagementPage />
      <NotificationRecipientsSection />
      <DataResetSection />
    </div>
  )
}
