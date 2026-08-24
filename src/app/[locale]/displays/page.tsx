import { DisplayManager } from '@/components/display-manager'
import { requirePageAdministrator } from '@/server/session'

const displaysPage = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params
  await requirePageAdministrator(locale)
  return <DisplayManager />
}

export default displaysPage
