'use client'

import { Flexbox, Text } from '@lobehub/ui'
import { type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type ConsolePageHeaderProps = {
  eyebrow: string
  icon: LucideIcon
  title: string
  subtitle: string
  back_label: string
  language_label: string
  actions?: ReactNode
}

export function ConsolePageHeader({ actions, eyebrow, icon: Icon, subtitle, title }: ConsolePageHeaderProps) {
  return (
    <header className="console-page-header">
      <Flexbox className="console-page-title" gap={10}>
        <Text className="eyebrow"><Icon aria-hidden />{eyebrow}</Text>
        <h1>{title}</h1>
        <Text className="header-subtitle">{subtitle}</Text>
      </Flexbox>
      {actions && <Flexbox className="console-page-tools" horizontal align="center" gap={10} wrap="wrap">{actions}</Flexbox>}
    </header>
  )
}
