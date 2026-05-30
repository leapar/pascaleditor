'use client'

import { Keyboard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../../../../components/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../../components/ui/primitives/dialog'
import { messages, useLocale } from '../../../../../lib/i18n'
import { ShortcutToken } from '../../../../../components/ui/primitives/shortcut-token'

type Shortcut = {
  keys: string[]
  actionKey: string
  noteKey?: string
}

type ShortcutCategory = {
  titleKey: string
  shortcuts: Shortcut[]
}

const KEY_DISPLAY_MAP: Record<string, string> = {
  'Arrow Up': '↑',
  'Arrow Down': '↓',
  Esc: '⎋',
  Shift: '⇧',
  Space: '␣',
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    titleKey: 'shortcuts.editorNavigation',
    shortcuts: [
      { keys: ['1'], actionKey: 'shortcuts.switchToSitePhase' },
      { keys: ['2'], actionKey: 'shortcuts.switchToStructurePhase' },
      { keys: ['3'], actionKey: 'shortcuts.switchToFurnishPhase' },
      { keys: ['S'], actionKey: 'shortcuts.switchToStructureLayer' },
      { keys: ['F'], actionKey: 'shortcuts.switchToFurnishLayer' },
      { keys: ['Z'], actionKey: 'shortcuts.switchToZonesLayer' },
      {
        keys: ['Cmd/Ctrl', 'Arrow Up'],
        actionKey: 'shortcuts.selectNextLevel',
      },
      {
        keys: ['Cmd/Ctrl', 'Arrow Down'],
        actionKey: 'shortcuts.selectPreviousLevel',
      },
      { keys: ['Cmd/Ctrl', 'B'], actionKey: 'shortcuts.toggleSidebar' },
    ],
  },
  {
    titleKey: 'shortcuts.modesAndHistory',
    shortcuts: [
      { keys: ['V'], actionKey: 'shortcuts.switchToSelectMode' },
      { keys: ['B'], actionKey: 'shortcuts.switchToBuildMode' },
      {
        keys: ['Esc'],
        actionKey: 'shortcuts.cancelTool',
      },
      { keys: ['Delete / Backspace'], actionKey: 'shortcuts.deleteOrBackspace' },
      { keys: ['Cmd/Ctrl', 'Z'], actionKey: 'shortcuts.undo' },
      { keys: ['Cmd/Ctrl', 'Shift', 'Z'], actionKey: 'shortcuts.redo' },
    ],
  },
  {
    titleKey: 'shortcuts.selection',
    shortcuts: [
      {
        keys: ['Cmd/Ctrl', 'Left click'],
        actionKey: 'shortcuts.addOrRemoveFromSelection',
        noteKey: 'shortcuts.worksWhileInSelectMode',
      },
    ],
  },
  {
    titleKey: 'shortcuts.drawingTools',
    shortcuts: [
      {
        keys: ['Shift'],
        actionKey: 'shortcuts.disableAngleSnapping',
        noteKey: 'shortcuts.holdWhileDrawing',
      },
    ],
  },
  {
    titleKey: 'shortcuts.itemPlacement',
    shortcuts: [
      { keys: ['R'], actionKey: 'shortcuts.rotateItemClockwise' },
      { keys: ['T'], actionKey: 'shortcuts.rotateItemCounterClockwise' },
      {
        keys: ['Shift'],
        actionKey: 'shortcuts.bypassPlacementValidation',
        noteKey: 'shortcuts.holdWhilePlacing',
      },
    ],
  },
  {
    titleKey: 'shortcuts.camera',
    shortcuts: [
      {
        keys: ['Middle click'],
        actionKey: 'shortcuts.panCamera',
        noteKey: 'shortcuts.dragMiddleMouseOrHoldSpace',
      },
      {
        keys: ['Right click'],
        actionKey: 'shortcuts.orbitCamera',
        noteKey: 'shortcuts.dragRightMouse',
      },
    ],
  },
]

function getDisplayKey(key: string, isMac: boolean): string {
  if (key === 'Cmd/Ctrl') return isMac ? '⌘' : 'Ctrl'
  if (key === 'Delete / Backspace') return isMac ? '⌫' : 'Backspace'
  return KEY_DISPLAY_MAP[key] ?? key
}

function ShortcutKeys({ keys }: { keys: string[] }) {
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-1">
      {keys.map((key, index) => (
        <div className="flex items-center gap-1" key={`${key}-${index}`}>
          {index > 0 ? <span className="text-[10px] text-muted-foreground">+</span> : null}
          <ShortcutToken displayValue={getDisplayKey(key, isMac)} value={key} />
        </div>
      ))}
    </div>
  )
}

export function KeyboardShortcutsDialog() {
  const { locale } = useLocale()
  const t = (key: string) => (messages[locale as 'en' | 'zh'] as Record<string, string>)[key] || key
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2" variant="outline">
          <Keyboard className="size-4" />
          {t('shortcuts.keyboardShortcuts')}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{t('shortcuts.keyboardShortcuts')}</DialogTitle>
          <DialogDescription>
            {t('shortcuts.contextAware')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {SHORTCUT_CATEGORIES.map((category) => (
            <section className="space-y-2" key={category.titleKey}>
              <h3 className="font-medium text-sm">{t(category.titleKey)}</h3>
              <div className="overflow-hidden rounded-md border border-border/80">
                {category.shortcuts.map((shortcut, index) => (
                  <div
                    className="grid grid-cols-[minmax(130px,220px)_1fr] gap-3 px-3 py-2"
                    key={`${category.titleKey}-${shortcut.actionKey}`}
                  >
                    <ShortcutKeys keys={shortcut.keys} />
                    <div>
                      <p className="text-sm">{t(shortcut.actionKey)}</p>
                      {shortcut.noteKey ? (
                        <p className="text-muted-foreground text-xs">{t(shortcut.noteKey)}</p>
                      ) : null}
                    </div>
                    {index < category.shortcuts.length - 1 ? (
                      <div className="col-span-2 border-border/60 border-b" />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
