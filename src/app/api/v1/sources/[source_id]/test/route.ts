import { NextResponse } from 'next/server'

import { currentAdministrator } from '@/server/session'
import { refreshUsageSource } from '@/server/usage-source'

export const POST = async (request: Request, { params }: { params: Promise<{ source_id: string }> }) => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ values: await refreshUsageSource((await params).source_id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'source_test_failed' }, { status: 400 })
  }
}
