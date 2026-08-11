import { NextResponse } from 'next/server'
import { z } from 'zod'

import { render_display_preview } from '@/server/preview'
import { current_administrator } from '@/server/session'

const document_schema = z.object({ title: z.string().min(1).max(48), subtitle: z.string().max(80).optional(), icon: z.enum(['usage', 'alert', 'battery', 'wifi', 'system']).optional(), progress: z.object({ value: z.union([z.number(), z.string().max(48)]), max: z.union([z.number(), z.string().max(48)]), label: z.string().max(48).optional(), unit: z.string().max(16).optional() }).optional(), lines: z.array(z.object({ label: z.string().max(48), value: z.string().max(48) })).max(7).optional() })

export async function POST(request: Request) {
  if (!await current_administrator()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = document_schema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_display_document', issues: body.error.issues }, { status: 400 })
  return NextResponse.json({ preview_svg: render_display_preview(body.data), width: 400, height: 300 })
}
