import { NextResponse } from 'next/server'
import { renderDisplayPreview } from '@/server/display/preview'
import { currentAdministrator } from '@/server/auth/session'
import type { PreviewReleaseResponse } from '@/lib/api-contracts'
import { displayDocumentSchema } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const body = displayDocumentSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_display_document', issues: body.error.issues }, { status: 400 })
  }
  const response: PreviewReleaseResponse = { preview_svg: renderDisplayPreview(body.data), width: 400, height: 300 }
  return NextResponse.json(response)
}
