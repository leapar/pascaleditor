'use client'

import { Editor, FilePanel, ItemsPanel, useLocale, messages } from '@pascal-app/editor'
import { Boxes } from 'lucide-react'
import { SceneIcon } from '@/components/icons/scene-icon'
import { FileIcon } from '@/components/icons/file-icon'
import { SettingsIcon } from '@/components/icons/settings-icon'
import {
  CommunityViewerToolbarLeft,
  CommunityViewerToolbarRight,
} from '@/components/viewer-toolbar'

const SIDEBAR_TABS = [
  {
    id: 'file',
    labelKey: 'sidebar.file',
    component: FilePanel,
    mobileDefaultSnap: 0.5,
    mobileIcon: <FileIcon className="h-5 w-5" />,
    icon: <FileIcon className="h-6 w-6" />,
  },
  {
    id: 'site',
    labelKey: 'sidebar.scene',
    component: () => null,
    mobileDefaultSnap: 0.5,
    mobileIcon: <SceneIcon className="h-5 w-5" />,
    icon: <SceneIcon className="h-6 w-6" />,
  },
  {
    id: 'items',
    labelKey: 'sidebar.items',
    component: ItemsPanel,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Boxes className="h-5 w-5" />,
    icon: <Boxes className="h-6 w-6" />,
  },
  {
    id: 'settings',
    labelKey: 'common.settings',
    component: () => null,
    mobileDefaultSnap: 0.5,
    mobileIcon: <SettingsIcon className="h-5 w-5" />,
    icon: <SettingsIcon className="h-6 w-6" />,
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
    icon: tab.icon,
  }))

  return (
    <div className="relative h-screen w-screen">
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
