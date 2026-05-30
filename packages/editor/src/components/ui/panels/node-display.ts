import type { AnyNode } from '@pascal-app/core'
import { messages } from '../../../lib/i18n'

export type NodeDisplay = {
  icon: string
  /** i18n key or custom name */
  labelKey: string
}

const TYPE_DEFAULTS: Record<string, NodeDisplay> = {
  item: { icon: '/icons/furniture.png', labelKey: 'nodeTypes.item' },
  wall: { icon: '/icons/wall.png', labelKey: 'nodeTypes.wall' },
  door: { icon: '/icons/door.png', labelKey: 'nodeTypes.door' },
  window: { icon: '/icons/window.png', labelKey: 'nodeTypes.window' },
  slab: { icon: '/icons/floor.png', labelKey: 'nodeTypes.slab' },
  ceiling: { icon: '/icons/ceiling.png', labelKey: 'nodeTypes.ceiling' },
  column: { icon: '/icons/column.png', labelKey: 'nodeTypes.column' },
  elevator: { icon: '/icons/elevator.png', labelKey: 'nodeTypes.elevator' },
  fence: { icon: '/icons/fence.png', labelKey: 'nodeTypes.fence' },
  roof: { icon: '/icons/roof.png', labelKey: 'nodeTypes.roof' },
  'roof-segment': { icon: '/icons/roof.png', labelKey: 'nodeTypes.roofSegment' },
  stair: { icon: '/icons/stair.png', labelKey: 'nodeTypes.stairs' },
  'stair-segment': { icon: '/icons/stair.png', labelKey: 'nodeTypes.stairSegment' },
  scan: { icon: '/icons/mesh.png', labelKey: 'nodeTypes.scan' },
  guide: { icon: '/icons/floorplan.png', labelKey: 'nodeTypes.guide' },
  shelf: { icon: '/icons/shelf.png', labelKey: 'nodeTypes.shelf' },
  spawn: { icon: '/icons/site.png', labelKey: 'nodeTypes.spawn' },
  boxVent: { icon: '/icons/box-vent.png', labelKey: 'nodeTypes.boxVent' },
  chimney: { icon: '/icons/chimney.png', labelKey: 'nodeTypes.chimney' },
  dormer: { icon: '/icons/dormer.png', labelKey: 'nodeTypes.dormer' },
  ridgeVent: { icon: '/icons/ridge-vent.png', labelKey: 'nodeTypes.ridgeVent' },
  solarPanel: { icon: '/icons/solar-panel.png', labelKey: 'nodeTypes.solarPanel' },
}

/**
 * Returns display info for a node.
 * labelKey is either an i18n key (nodeTypes.XXX) or a custom name set by the user.
 */
export function getNodeDisplay(node: AnyNode | null | undefined): NodeDisplay {
  if (!node) return { icon: '/icons/select.png', labelKey: 'Selection' }
  const fallback = TYPE_DEFAULTS[node.type] ?? { icon: '/icons/select.png', labelKey: node.type }
  // Item nodes carry an asset with its own thumbnail/name
  if (node.type === 'item') {
    const name = node.name || node.asset?.name
    return {
      icon: node.asset?.thumbnail || fallback.icon,
      labelKey: name || fallback.labelKey,
    }
  }
  return {
    icon: fallback.icon,
    labelKey: node.name || fallback.labelKey,
  }
}

/** Resolve a node type label key to a translated string */
export function resolveNodeLabel(labelKey: string, locale: string): string {
  return (messages[locale as 'en' | 'zh'] as Record<string, string>)[labelKey] || labelKey
}
