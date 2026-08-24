import { AlertsManager } from '@/app/alerts/_components/alerts-manager'
import { requirePageAdministrator } from '@/server/auth/session'

const alertsPage = async () => {
  await requirePageAdministrator()
  return <AlertsManager />
}

export default alertsPage
