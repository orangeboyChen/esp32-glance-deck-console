import { redirect } from 'next/navigation'

import { SetupManager } from '@/components/auth-manager'
import { administratorExists } from '@/server/session'

const setupPage = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params
  if (await administratorExists()) redirect(`/${locale}/login`)
  return <SetupManager />
}

export default setupPage
