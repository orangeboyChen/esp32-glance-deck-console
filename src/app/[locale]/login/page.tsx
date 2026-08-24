import { redirect } from 'next/navigation'

import { LoginManager } from '@/components/auth-manager'
import { administratorExists } from '@/server/session'

const loginPage = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params
  if (!(await administratorExists())) redirect(`/${locale}/setup`)
  return <LoginManager />
}

export default loginPage
