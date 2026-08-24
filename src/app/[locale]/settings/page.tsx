import { SettingsManager } from '@/components/settings-manager'
import { requirePageAdministrator } from '@/server/session'

const settingsPage = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params
  await requirePageAdministrator(locale)
  return <SettingsManager />
}

export default settingsPage
