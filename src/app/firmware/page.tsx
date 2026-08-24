import { FirmwareManager } from '@/app/firmware/_components/firmware-manager'
import { requirePageAdministrator } from '@/server/auth/session'

const firmwarePage = async () => {
  await requirePageAdministrator()
  return <FirmwareManager />
}

export default firmwarePage
