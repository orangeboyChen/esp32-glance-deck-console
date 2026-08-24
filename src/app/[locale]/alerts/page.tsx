import { AlertsManager } from '@/components/alerts-manager'
import { requirePageAdministrator } from '@/server/session'

const alertsPage = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params
  await requirePageAdministrator(locale)
  return <AlertsManager />
}

export default alertsPage
