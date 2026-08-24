import { NextResponse } from 'next/server'

import { previewCcSwitchImport } from '@/server/source/cc-switch-import'
import { currentAdministrator } from '@/server/auth/session'
import { jsonValueSchema } from '@/lib/api-contracts'
import type { PreviewCcSwitchResponse } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const input = jsonValueSchema.parse(await request.json())
    const preview = previewCcSwitchImport(input)
    const response: PreviewCcSwitchResponse = { preview }
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'cc_switch_export_invalid' }, { status: 400 })
  }
}
