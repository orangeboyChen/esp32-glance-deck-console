import { SourcesManager } from '@/app/sources/_components/sources-manager'
import { requirePageAdministrator } from '@/server/auth/session'

const sourcesPage = async () => {
  await requirePageAdministrator()
  return <SourcesManager />
}

export default sourcesPage
