import { FirmwareManager } from '@/components/firmware-manager'
import { requirePageAdministrator } from '@/server/session'

const firmwarePage = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params
  await requirePageAdministrator(locale)
  return <FirmwareManager />
}

export default firmwarePage
