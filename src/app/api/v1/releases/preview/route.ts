import { NextResponse } from 'next/server'
import { z } from 'zod'

import { renderDisplayPreview } from '@/server/preview'
import { currentAdministrator } from '@/server/session'

const progressSchema = z.object({
  value: z.union([z.number(), z.string().max(48)]),
  max: z.union([z.number(), z.string().max(48)]),
  label: z.string().max(48).optional(),
  unit: z.string().max(16).optional(),
})
const documentSchema = z.object({
  title: z.string().min(1).max(48),
  subtitle: z.string().max(80).optional(),
  icon: z.enum(['usage', 'battery', 'wifi', 'system', 'home']).optional(),
  progress: progressSchema.optional(),
  progresses: z.array(progressSchema).min(1).max(3).optional(),
  usage_details: z
    .array(z.object({ remaining: z.string().max(48).optional(), resets_at: z.string().max(48).optional() }))
    .max(3)
    .optional(),
  lines: z
    .array(z.object({ label: z.string().max(48), value: z.string().max(48) }))
    .max(7)
    .optional(),
})

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = documentSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_display_document', issues: body.error.issues }, { status: 400 })
  return NextResponse.json({ preview_svg: renderDisplayPreview(body.data), width: 400, height: 300 })
}
