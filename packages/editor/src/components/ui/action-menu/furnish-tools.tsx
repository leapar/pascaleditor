import type { CatalogCategory } from './../../../store/use-editor'

export type FurnishToolConfig = {
  id: 'item'
  iconSrc: string
  labelKey: string
  catalogCategory: CatalogCategory
}

export const furnishTools: FurnishToolConfig[] = [
  { id: 'item', iconSrc: '/icons/couch.png', labelKey: 'furnishTools.furniture', catalogCategory: 'furniture' },
  { id: 'item', iconSrc: '/icons/appliance.png', labelKey: 'furnishTools.appliance', catalogCategory: 'appliance' },
  { id: 'item', iconSrc: '/icons/kitchen.png', labelKey: 'furnishTools.kitchen', catalogCategory: 'kitchen' },
  { id: 'item', iconSrc: '/icons/bathroom.png', labelKey: 'furnishTools.bathroom', catalogCategory: 'bathroom' },
  { id: 'item', iconSrc: '/icons/tree.png', labelKey: 'furnishTools.outdoor', catalogCategory: 'outdoor' },
]
