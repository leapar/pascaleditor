'use client'

import type { ComponentType, ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './../../../components/ui/primitives/tooltip'
import { cn } from './../../../lib/utils'
import { messages, useLocale } from '../../../lib/i18n'

export type PanelId = string

export type ExtraPanel = { id: string; icon: ReactNode; label: string; component: ComponentType }

interface IconRailProps {
  activePanel: PanelId
  onPanelChange: (panel: PanelId) => void
  appMenuButton?: ReactNode
  extraPanels?: ExtraPanel[]
  className?: string
}

const sitePanel: { id: PanelId; iconSrc: string; labelKey: string } = {
  id: 'site',
  iconSrc: '/icons/level.png',
  labelKey: 'sidebar.site',
}

const settingsPanel: { id: PanelId; iconSrc: string; labelKey: string } = {
  id: 'settings',
  iconSrc: '/icons/settings.png',
  labelKey: 'common.settings',
}

const panels: { id: PanelId; iconSrc: string; labelKey: string }[] = [sitePanel, settingsPanel]

export function IconRail({
  activePanel,
  onPanelChange,
  appMenuButton,
  extraPanels,
  className,
}: IconRailProps) {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  return (
    <div
      className={cn(
        'flex h-full w-11 flex-col items-center gap-1 border-border/50 border-r py-2',
        className,
      )}
    >
      {/* App menu slot */}
      {appMenuButton}

      {/* Divider */}
      <div className="mb-1 h-px w-8 bg-border/50" />

      {/* Site panel */}
      {[sitePanel].map((panel) => {
        const isActive = activePanel === panel.id
        return (
          <Tooltip key={panel.id}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg transition-all',
                  isActive ? 'bg-accent' : 'hover:bg-accent',
                )}
                onClick={() => onPanelChange(panel.id)}
                type="button"
              >
                <img
                  alt={t(panel.labelKey)}
                  className={cn(
                    'h-6 w-6 object-contain transition-all',
                    !isActive && 'opacity-50 saturate-0',
                  )}
                  src={panel.iconSrc}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t(panel.labelKey)}</TooltipContent>
          </Tooltip>
        )
      })}

      {/* Extra panels (injected between site and settings) */}
      {extraPanels?.map((panel) => {
        const isActive = activePanel === panel.id
        return (
          <Tooltip key={panel.id}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg transition-all',
                  isActive ? 'bg-accent' : 'hover:bg-accent',
                )}
                onClick={() => onPanelChange(panel.id)}
                type="button"
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center transition-all',
                    !isActive && 'opacity-50',
                  )}
                >
                  {panel.icon}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{panel.label}</TooltipContent>
          </Tooltip>
        )
      })}

      {/* Settings panel */}
      {[settingsPanel].map((panel) => {
        const isActive = activePanel === panel.id
        return (
          <Tooltip key={panel.id}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg transition-all',
                  isActive ? 'bg-accent' : 'hover:bg-accent',
                )}
                onClick={() => onPanelChange(panel.id)}
                type="button"
              >
                <img
                  alt={t(panel.labelKey)}
                  className={cn(
                    'h-6 w-6 object-contain transition-all',
                    !isActive && 'opacity-50 saturate-0',
                  )}
                  src={panel.iconSrc}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t(panel.labelKey)}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

export { panels }
