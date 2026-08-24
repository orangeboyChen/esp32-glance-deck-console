import { SourcesManager } from '@/components/sources-manager'
import { requirePageAdministrator } from '@/server/session'

const sourcesPage = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params
  await requirePageAdministrator(locale)
  return <SourcesManager />
}

export default sourcesPage
