import { DeviceDashboard } from '@/app/_components/dashboard/device-dashboard'
import { dashboardSummary, listDevices } from '@/server/device/devices'
import { requirePageAdministrator } from '@/server/auth/session'

const overviewPage = async () => {
  await requirePageAdministrator()
  const [devices, summary] = await Promise.all([listDevices(), dashboardSummary()])
  return <DeviceDashboard devices={devices} summary={summary} />
}

export default overviewPage
