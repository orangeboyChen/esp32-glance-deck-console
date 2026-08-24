import { DeviceDashboard } from '@/components/device-dashboard'
import { dashboardSummary, listDevices } from '@/server/devices'
import { requirePageAdministrator } from '@/server/session'

const overviewPage = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params
  await requirePageAdministrator(locale)
  const [devices, summary] = await Promise.all([listDevices(), dashboardSummary()])
  return <DeviceDashboard devices={devices} summary={summary} />
}

export default overviewPage
