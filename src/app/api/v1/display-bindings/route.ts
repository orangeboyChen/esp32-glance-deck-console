import { NextResponse } from 'next/server'
import { z } from 'zod'

import { db } from '@/server/db'
import { currentAdministrator } from '@/server/session'
import { displayBindings } from '@/server/schema'

const documentSchema = z.object({
  title: z.string().min(1).max(48),
  subtitle: z.string().max(80).optional(),
  icon: z.enum(['usage', 'battery', 'wifi', 'system', 'home']).optional(),
  progress: z
    .object({
      value: z.union([z.number(), z.string().max(48)]),
      max: z.union([z.number(), z.string().max(48)]),
      label: z.string().max(48).optional(),
      unit: z.string().max(16).optional(),
    })
    .optional(),
  progresses: z
    .array(
      z.object({
        value: z.union([z.number(), z.string().max(48)]),
        max: z.union([z.number(), z.string().max(48)]),
        label: z.string().max(48).optional(),
        unit: z.string().max(16).optional(),
      }),
    )
    .min(1)
    .max(3)
    .optional(),
  usage_details: z
    .array(z.object({ remaining: z.string().max(48).optional(), resets_at: z.string().max(48).optional() }))
    .max(3)
    .optional(),
  lines: z
    .array(z.object({ label: z.string().max(48), value: z.string().max(48) }))
    .max(7)
    .optional(),
})
const bindingSchema = z.object({
  source_id: z.uuid(),
  page_id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  document_template: documentSchema,
  device_ids: z.array(z.string().regex(/^[a-z0-9-]{1,64}$/)).min(1),
})

export const GET = async () => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  return NextResponse.json({ bindings: await db.select().from(displayBindings) })
}

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const body = bindingSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_display_binding', issues: body.error.issues }, { status: 400 })
  const [binding] = await db.insert(displayBindings).values(body.data).returning()
  return NextResponse.json({ binding }, { status: 201 })
}
