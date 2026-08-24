import { NextResponse } from 'next/server'

import { currentAdministrator } from '@/server/auth/session'
import { refreshUsageSource } from '@/server/source/usage-source'
import type { TestSourceResponse } from '@/lib/api-contracts'

export const POST = async (request: Request, { params }: { params: Promise<{ source_id: string }> }) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const response: TestSourceResponse = { values: await refreshUsageSource((await params).source_id) }
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'source_test_failed' }, { status: 400 })
  }
}
