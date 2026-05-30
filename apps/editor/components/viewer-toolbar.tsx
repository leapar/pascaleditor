'use client'

import { Icon as IconifyIcon } from '@iconify/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useEditor,
  useLocale,
  messages,
  useSidebarStore,
  type ViewMode,
} from '@pascal-app/editor'
import {
  CLAY_PALETTE,
  type EdgeMode,
  getSceneTheme,
  SCENE_THEMES,
  useViewer,
} from '@pascal-app/viewer'
import {
  Box,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Columns2,
  Contrast,
  Eye,
  EyeOff,
  Footprints,
  Grid2X2,
  PenLine,
  Sparkles,
  SwatchBook,
} from 'lucide-react'
import Image from 'next/image'
import { type ReactNode, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './toolbar-tooltip'

const TOOLBAR_CONTAINER =
  'inline-flex h-8 items-stretch overflow-hidden rounded-xl border border-border bg-background/90 shadow-2xl backdrop-blur-md'

const TOOLBAR_BTN =
  'flex w-8 items-center justify-center text-muted-foreground/80 transition-colors hover:bg-white/8 hover:text-foreground/90'

function ToolbarTooltip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

const VIEW_MODES: { id: ViewMode; icon: React.ReactNode }[] = [
  {
    id: '3d',
    icon: (
      <Image
        alt=""
        className="h-3.5 w-3.5 object-contain"
        height={14}
        src="/icons/building.png"
        width={14}
      />
    ),
  },
  {
    id: '2d',
    icon: (
      <Image
        alt=""
        className="h-3.5 w-3.5 object-contain"
        height={14}
        src="/icons/blueprint.png"
        width={14}
      />
    ),
  },
  {
    id: 'split',
    icon: <Columns2 className="h-3 w-3" />,
  },
]

const levelModeOrder = ['stacked', 'exploded', 'solo'] as const

const wallModeOrder = ['cutaway', 'up', 'down'] as const
const wallModeConfig: Record<string, { icon: string }> = {
  up: { icon: '/icons/room.png' },
  cutaway: { icon: '/icons/wallcut.png' },
  down: { icon: '/icons/walllow.png' },
}

const SHADING_OPTIONS = [
  { id: 'solid', nameKey: 'viewer.solid', detailKey: 'viewer.flatAndFast', icon: Box },
  { id: 'rendered', nameKey: 'viewer.rendered', detailKey: 'viewer.fullAO', icon: Sparkles },
] as const

function ViewModeControl() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const viewMode = useEditor((state) => state.viewMode)
  const setViewMode = useEditor((state) => state.setViewMode)

  const modeLabels: Record<ViewMode, string> = {
    '3d': t('viewer.viewMode3D'),
    '2d': t('viewer.viewMode2D'),
    split: t('viewer.viewModeSplit'),
  }

  return (
    <div className={TOOLBAR_CONTAINER}>
      {VIEW_MODES.map((mode) => {
        const isActive = viewMode === mode.id
        const label = modeLabels[mode.id]
        return (
          <ToolbarTooltip key={mode.id} label={label}>
            <button
              aria-label={label}
              aria-pressed={isActive}
              className={cn(
                'flex items-center justify-center gap-1.5 px-2.5 font-medium text-xs transition-colors',
                isActive
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground/70 hover:bg-white/8 hover:text-muted-foreground',
              )}
              onClick={() => setViewMode(mode.id)}
              type="button"
            >
              {mode.icon}
              <span>{label}</span>
            </button>
          </ToolbarTooltip>
        )
      })}
    </div>
  )
}

function CollapseSidebarButton() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const isCollapsed = useSidebarStore((state) => state.isCollapsed)
  const setIsCollapsed = useSidebarStore((state) => state.setIsCollapsed)

  const toggle = useCallback(() => {
    setIsCollapsed(!isCollapsed)
  }, [isCollapsed, setIsCollapsed])

  return (
    <div className={TOOLBAR_CONTAINER}>
      <ToolbarTooltip label={isCollapsed ? t('viewer.expandSidebar') : t('viewer.collapseSidebar')}>
        <button
          aria-label={isCollapsed ? t('viewer.expandSidebar') : t('viewer.collapseSidebar')}
          className={TOOLBAR_BTN}
          onClick={toggle}
          type="button"
        >
          {isCollapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </ToolbarTooltip>
    </div>
  )
}

function LevelModeToggle() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const levelMode = useViewer((state) => state.levelMode)
  const setLevelMode = useViewer((state) => state.setLevelMode)
  const isDefault = levelMode === 'stacked' || levelMode === 'manual'

  const cycle = () => {
    if (levelMode === 'manual') {
      setLevelMode('stacked')
      return
    }

    const index = levelModeOrder.indexOf(levelMode as (typeof levelModeOrder)[number])
    const next = levelModeOrder[(index + 1) % levelModeOrder.length]
    if (next) setLevelMode(next)
  }

  const levelLabels: Record<string, string> = { manual: t('viewer.manual'), stacked: t('viewer.stack'), exploded: t('viewer.exploded'), solo: t('viewer.solo') }
  const label = `${t('viewer.levels')}: ${levelLabels[levelMode] ?? t('viewer.stack')}`

  return (
    <ToolbarTooltip label={label}>
      <button
        className={cn(
          TOOLBAR_BTN,
          'w-auto gap-1.5 px-2.5',
          !isDefault && 'bg-white/10 text-foreground/90',
        )}
        onClick={cycle}
        type="button"
      >
        {levelMode === 'solo' ? (
          <IconifyIcon height={14} icon="lucide:diamond" width={14} />
        ) : levelMode === 'exploded' ? (
          <IconifyIcon height={14} icon="charm:stack-pop" width={14} />
        ) : (
          <IconifyIcon height={14} icon="charm:stack-push" width={14} />
        )}
        <span className="font-medium text-xs">{levelLabels[levelMode] ?? t('viewer.stack')}</span>
      </button>
    </ToolbarTooltip>
  )
}

function WallModeToggle() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const wallMode = useViewer((state) => state.wallMode)
  const setWallMode = useViewer((state) => state.setWallMode)
  const config = wallModeConfig[wallMode] ?? wallModeConfig.cutaway!

  const cycle = () => {
    const index = wallModeOrder.indexOf(wallMode as (typeof wallModeOrder)[number])
    const next = wallModeOrder[(index + 1) % wallModeOrder.length]
    if (next) setWallMode(next)
  }

  const labelKey = wallMode === 'up' ? 'toolbar.fullHeight' : wallMode === 'down' ? 'toolbar.low' : 'toolbar.cutaway'

  return (
    <ToolbarTooltip label={`${t('toolbar.walls')}: ${t(labelKey)}`}>
      <button
        className={cn(
          TOOLBAR_BTN,
          'w-auto gap-1.5 px-2.5',
          wallMode !== 'cutaway'
            ? 'bg-white/10'
            : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0',
        )}
        onClick={cycle}
        type="button"
      >
        <Image alt="" className="h-4 w-4 object-contain" height={16} src={config.icon} width={16} />
        <span className="font-medium text-xs">{t(labelKey)}</span>
      </button>
    </ToolbarTooltip>
  )
}

function RenderModeMenu() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const shading = useViewer((state) => state.shading)
  const setShading = useViewer((state) => state.setShading)
  const active = SHADING_OPTIONS.find((option) => option.id === shading) ?? SHADING_OPTIONS[0]
  const ActiveIcon = active.icon

  return (
    <DropdownMenu>
      <ToolbarTooltip label={`${t('viewer.render')}: ${t(active.nameKey)}`}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`${t('viewer.render')}: ${t(active.nameKey)}`}
            className={cn(
              TOOLBAR_BTN,
              'w-auto gap-1.5 px-2.5',
              shading === 'rendered' && 'bg-white/10 text-foreground/90',
            )}
            type="button"
          >
            <ActiveIcon className="h-3.5 w-3.5" />
            <span className="font-medium text-xs">{t(active.nameKey)}</span>
          </button>
        </DropdownMenuTrigger>
      </ToolbarTooltip>
      <DropdownMenuContent align="center" className="min-w-56" side="bottom">
        {SHADING_OPTIONS.map((option) => {
          const OptionIcon = option.icon
          return (
            <DropdownMenuItem key={option.id} onSelect={() => setShading(option.id)}>
              <OptionIcon className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="text-foreground">{t(option.nameKey)}</span>
                <span className="text-muted-foreground text-xs">{t(option.detailKey)}</span>
              </div>
              {shading === option.id ? <Check className="ml-auto h-4 w-4 text-foreground" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SceneThemeMenu() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const sceneTheme = useViewer((state) => state.sceneTheme)
  const setSceneTheme = useViewer((state) => state.setSceneTheme)
  const active = getSceneTheme(sceneTheme)

  return (
    <DropdownMenu>
      <ToolbarTooltip label={`${t('viewer.sceneTheme')}: ${active.name}`}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`${t('viewer.sceneTheme')}: ${active.name}`}
            className={cn(TOOLBAR_BTN, 'w-28 gap-1.5 px-2.5 text-foreground/90')}
            type="button"
          >
            <SwatchBook className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium text-xs">{active.name}</span>
          </button>
        </DropdownMenuTrigger>
      </ToolbarTooltip>
      <DropdownMenuContent align="center" className="min-w-48" side="bottom">
        {SCENE_THEMES.map((theme) => {
          const swatches = (['wall', 'roof', 'floor', 'glazing'] as const).map(
            (role) => theme.clayTints?.[role] ?? CLAY_PALETTE[role],
          )
          return (
            <DropdownMenuItem key={theme.id} onSelect={() => setSceneTheme(theme.id)}>
              <span
                className="grid h-5 w-5 shrink-0 grid-cols-2 overflow-hidden rounded-sm border border-black/10"
                style={{ backgroundColor: theme.background }}
              >
                {swatches.map((color, index) => (
                  <span key={`${theme.id}-${index}`} style={{ backgroundColor: color }} />
                ))}
              </span>
              <span className="text-foreground">{theme.name}</span>
              {sceneTheme === theme.id ? (
                <Check className="ml-auto h-4 w-4 text-foreground" />
              ) : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const EDGE_OPTIONS = [
  { id: 'off', nameKey: 'viewer.off_edge', detailKey: 'viewer.noEdgeLines' },
  { id: 'soft', nameKey: 'viewer.soft', detailKey: 'viewer.faintOutline' },
  { id: 'strong', nameKey: 'viewer.strong', detailKey: 'viewer.crispEdges' },
] as const satisfies readonly { id: EdgeMode; nameKey: string; detailKey: string }[]

function EdgesMenu() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const edges = useViewer((state) => state.edges)
  const setEdges = useViewer((state) => state.setEdges)
  const active = EDGE_OPTIONS.find((option) => option.id === edges) ?? EDGE_OPTIONS[0]

  return (
    <DropdownMenu>
      <ToolbarTooltip label={`${t('viewer.edges')}: ${t(active.nameKey)}`}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`${t('viewer.edges')}: ${t(active.nameKey)}`}
            className={cn(TOOLBAR_BTN, edges !== 'off' && 'bg-white/10 text-foreground/90')}
            type="button"
          >
            <PenLine className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
      </ToolbarTooltip>
      <DropdownMenuContent align="center" className="min-w-56" side="bottom">
        {EDGE_OPTIONS.map((option) => {
          return (
            <DropdownMenuItem key={option.id} onSelect={() => setEdges(option.id)}>
              <div className="flex flex-col">
                <span className="text-foreground">{t(option.nameKey)}</span>
                <span className="text-muted-foreground text-xs">{t(option.detailKey)}</span>
              </div>
              {edges === option.id ? <Check className="ml-auto h-4 w-4 text-foreground" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GridVisibilityToggle() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const showGrid = useViewer((state) => state.showGrid)
  const setShowGrid = useViewer((state) => state.setShowGrid)

  return (
    <ToolbarTooltip label={`${t('viewer.grid')}: ${showGrid ? t('viewer.visible') : t('viewer.hidden')}`}>
      <button
        aria-label={`${t('viewer.grid')}: ${showGrid ? t('viewer.visible') : t('viewer.hidden')}`}
        aria-pressed={showGrid}
        className={cn(
          TOOLBAR_BTN,
          'w-auto gap-1.5 px-2.5',
          showGrid
            ? 'bg-white/10 text-foreground/90'
            : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0',
        )}
        onClick={() => setShowGrid(!showGrid)}
        type="button"
      >
        <Grid2X2 className="h-3.5 w-3.5" />
        {showGrid ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
    </ToolbarTooltip>
  )
}

function ShadowsToggle() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const shadows = useViewer((state) => state.shadows)
  const setShadows = useViewer((state) => state.setShadows)

  return (
    <ToolbarTooltip label={`${t('viewer.shadows')}: ${shadows ? t('viewer.on') : t('viewer.off')}`}>
      <button
        aria-label={`${t('viewer.shadows')}: ${shadows ? t('viewer.on') : t('viewer.off')}`}
        aria-pressed={shadows}
        className={cn(
          TOOLBAR_BTN,
          shadows
            ? 'bg-white/10 text-foreground/90'
            : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0',
        )}
        onClick={() => setShadows(!shadows)}
        type="button"
      >
        <Contrast className="h-3.5 w-3.5" />
      </button>
    </ToolbarTooltip>
  )
}

function UnitToggle() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const unit = useViewer((state) => state.unit)
  const setUnit = useViewer((state) => state.setUnit)

  return (
    <ToolbarTooltip label={unit === 'metric' ? t('viewer.metric') : t('viewer.imperial')}>
      <button
        className={TOOLBAR_BTN}
        onClick={() => setUnit(unit === 'metric' ? 'imperial' : 'metric')}
        type="button"
      >
        <span className="font-semibold text-[10px]">{unit === 'metric' ? 'm' : 'ft'}</span>
      </button>
    </ToolbarTooltip>
  )
}

function CameraModeToggle() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const cameraMode = useViewer((state) => state.cameraMode)
  const setCameraMode = useViewer((state) => state.setCameraMode)

  return (
    <ToolbarTooltip label={cameraMode === 'perspective' ? t('viewer.perspective') : t('viewer.orthographic')}>
      <button
        className={cn(
          TOOLBAR_BTN,
          cameraMode === 'orthographic' && 'bg-white/10 text-foreground/90',
        )}
        onClick={() => setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')}
        type="button"
      >
        {cameraMode === 'perspective' ? (
          <IconifyIcon height={16} icon="icon-park-outline:perspective" width={16} />
        ) : (
          <IconifyIcon height={16} icon="vaadin:grid" width={16} />
        )}
      </button>
    </ToolbarTooltip>
  )
}

function WalkthroughButton() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key
  const isFirstPersonMode = useEditor((state) => state.isFirstPersonMode)
  const setFirstPersonMode = useEditor((state) => state.setFirstPersonMode)

  return (
    <ToolbarTooltip label={t('viewer.walkthrough')}>
      <button
        className={cn(
          TOOLBAR_BTN,
          isFirstPersonMode && 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20',
        )}
        onClick={() => setFirstPersonMode(!isFirstPersonMode)}
        type="button"
      >
        <Footprints className="h-4 w-4" />
      </button>
    </ToolbarTooltip>
  )
}

function PreviewButton() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale] as Record<string, string>)[key] || key

  return (
    <ToolbarTooltip label={t('controlModes.preview')}>
      <button
        className="flex items-center gap-1.5 px-2.5 font-medium text-muted-foreground/80 text-xs transition-colors hover:bg-white/8 hover:text-foreground/90"
        onClick={() => useEditor.getState().setPreviewMode(true)}
        type="button"
      >
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span>{t('controlModes.preview')}</span>
      </button>
    </ToolbarTooltip>
  )
}

export function CommunityViewerToolbarLeft() {
  return (
    <>
      <CollapseSidebarButton />
      <ViewModeControl />
    </>
  )
}

export function CommunityViewerToolbarRight() {
  return (
    <div className={TOOLBAR_CONTAINER}>
      <LevelModeToggle />
      <WallModeToggle />
      <RenderModeMenu />
      <SceneThemeMenu />
      <EdgesMenu />
      <GridVisibilityToggle />
      <ShadowsToggle />
      <div className="my-1.5 w-px bg-border/50" />
      <UnitToggle />
      <CameraModeToggle />
      <div className="my-1.5 w-px bg-border/50" />
      <WalkthroughButton />
      <PreviewButton />
    </div>
  )
}
