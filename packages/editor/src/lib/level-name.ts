import type { LevelNode } from '@pascal-app/core'
import { messages } from './i18n'

export function getDefaultLevelName(level: number, locale: 'en' | 'zh' = 'zh'): string {
  const msgs = messages[locale] as Record<string, string>
  if (level === 0) return msgs['level.groundFloor'] || 'Ground Floor'
  if (level > 0) return msgs['level.floor']?.replace('{n}', String(level)) || `Floor ${level}`
  return msgs['level.basement']?.replace('{n}', String(-level)) || `Basement ${-level}`
}

export function getLevelDisplayName(level: Pick<LevelNode, 'name' | 'level'>, locale: 'en' | 'zh' = 'zh'): string {
  return level.name || getDefaultLevelName(level.level, locale)
}
