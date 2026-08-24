import { SettingsManager } from '@/app/settings/_components/settings-manager'
import { requirePageAdministrator } from '@/server/auth/session'

const settingsPage = async () => {
  await requirePageAdministrator()
  return <SettingsManager />
}

export default settingsPage
