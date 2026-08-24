import { redirect } from 'next/navigation'

import { LoginManager } from '@/app/login/_components/auth-manager'
import { administratorExists } from '@/server/auth/session'

const loginPage = async () => {
  if (!(await administratorExists())) {
    redirect('/setup')
  }
  return <LoginManager />
}

export default loginPage
