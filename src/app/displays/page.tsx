import { DisplayManager } from '@/app/displays/_components/display-manager'
import { requirePageAdministrator } from '@/server/auth/session'

const displaysPage = async () => {
  await requirePageAdministrator()
  return <DisplayManager />
}

export default displaysPage
