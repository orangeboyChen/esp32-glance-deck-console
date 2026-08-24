import { NextResponse } from 'next/server'

import { previewCcSwitchImport } from '@/server/source/cc-switch-import'
import { currentAdministrator } from '@/server/auth/session'

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ preview: previewCcSwitchImport(await request.json()) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'cc_switch_export_invalid' }, { status: 400 })
  }
}
