import { redirect } from 'next/navigation'

import { SetupManager } from '@/app/login/_components/auth-manager'
import { administratorExists } from '@/server/auth/session'

const setupPage = async () => {
  if (await administratorExists()) {
    redirect('/login')
  }
  return <SetupManager />
}

export default setupPage
