'use client'

import { Editor, ItemsPanel, useLocale, messages } from '@pascal-app/editor'
import { Layers, Package, Settings } from 'lucide-react'
import Link from 'next/link'
import {
  CommunityViewerToolbarLeft,
  CommunityViewerToolbarRight,
} from '@/components/viewer-toolbar'

const SIDEBAR_TABS = [
  {
    id: 'site',
    labelKey: 'sidebar.scene',
    component: () => null,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Layers className="h-5 w-5" />,
  },
  {
    id: 'items',
    labelKey: 'sidebar.items',
    component: ItemsPanel,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Package className="h-5 w-5" />,
  },
  {
    id: 'settings',
    labelKey: 'common.settings',
    component: () => null,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Settings className="h-5 w-5" />,
  },
]

const PROJECT_ID = 'local-editor'

export default function Home() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key

  const sidebarTabs = SIDEBAR_TABS.map((tab) => ({
    id: tab.id,
    label: t(tab.labelKey),
    component: tab.component,
    mobileDefaultSnap: tab.mobileDefaultSnap,
    mobileIcon: tab.mobileIcon,
  }))

  return (
    <div className="relative h-screen w-screen">
      {PROJECT_ID === 'local-editor' && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-40 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border/60 bg-background/90 px-4 py-1.5 text-xs shadow-sm backdrop-blur">
            <span className="text-muted-foreground">{t('editor.localWarning')}</span>
            <Link className="font-medium text-foreground hover:underline" href="/scenes">
              {t('editor.openRecent')}
            </Link>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <Link className="font-medium text-foreground hover:underline" href="/scenes">
              {t('editor.createNew')}
            </Link>
          </div>
        </div>
      )}
      <Editor
        layoutVersion="v2"
        projectId={PROJECT_ID}
        sidebarTabs={sidebarTabs}
        viewerToolbarLeft={<CommunityViewerToolbarLeft />}
        viewerToolbarRight={<CommunityViewerToolbarRight />}
      />
    </div>
  )
}
