'use client'

import {
  type AnyNode,
  type AnyNodeId,
  type RoofSegmentNode,
  RoofSegmentNode as RoofSegmentNodeSchema,
  type RoofType,
  useScene,
} from '@pascal-app/core'
import {
  ActionButton,
  ActionGroup,
  PanelSection,
  PanelWrapper,
  SegmentedControl,
  SliderControl,
  triggerSFX,
  useEditor,
  useTranslations,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { Copy, Move, Trash2 } from 'lucide-react'
import { useCallback } from 'react'


// Carpenter / roofer convention: rise over a 12" run, converted to degrees.
// atan(3/12) ≈ 14.04°, atan(6/12) ≈ 26.57°, atan(9/12) ≈ 36.87°, atan(12/12) = 45°.
const PITCH_PRESETS: { label: string; deg: number }[] = [
  { label: '3/12', deg: 14.04 },
  { label: '6/12', deg: 26.57 },
  { label: '9/12', deg: 36.87 },
  { label: '12/12', deg: 45 },
]

export default function RoofSegmentPanel() {
  const t = useTranslations()
  const selectedId = useViewer((s) => s.selection.selectedIds[0])

  const ROOF_TYPE_OPTIONS = [
    { label: t('nodes.roofSegment.hip'), value: 'hip' as RoofType },
    { label: t('nodes.roofSegment.gable'), value: 'gable' as RoofType },
    { label: t('nodes.roofSegment.shed'), value: 'shed' as RoofType },
    { label: t('nodes.roofSegment.flat'), value: 'flat' as RoofType },
  ]

  const ROOF_TYPE_OPTIONS_2 = [
    { label: t('nodes.roofSegment.gambrel'), value: 'gambrel' as RoofType },
    { label: t('nodes.roofSegment.dutch'), value: 'dutch' as RoofType },
    { label: t('nodes.roofSegment.mansard'), value: 'mansard' as RoofType },
  ]
  const setSelection = useViewer((s) => s.setSelection)
  const updateNode = useScene((s) => s.updateNode)
  const setMovingNode = useEditor((s) => s.setMovingNode)

  const node = useScene((s) =>
    selectedId ? (s.nodes[selectedId as AnyNode['id']] as RoofSegmentNode | undefined) : undefined,
  )

  const handleUpdate = useCallback(
    (updates: Partial<RoofSegmentNode>) => {
      if (!selectedId) return
      updateNode(selectedId as AnyNode['id'], updates)
    },
    [selectedId, updateNode],
  )

  const handleClose = useCallback(() => {
    setSelection({ selectedIds: [] })
  }, [setSelection])

  const handleBack = useCallback(() => {
    if (node?.parentId) {
      setSelection({ selectedIds: [node.parentId] })
    }
  }, [node?.parentId, setSelection])

  const handleDuplicate = useCallback(() => {
    if (!node?.parentId) return
    triggerSFX('sfx:item-pick')

    let duplicateInfo = structuredClone(node) as any
    delete duplicateInfo.id
    duplicateInfo.metadata = { ...duplicateInfo.metadata, isNew: true }
    // Offset slightly so it's visible
    duplicateInfo.position = [
      duplicateInfo.position[0] + 1,
      duplicateInfo.position[1],
      duplicateInfo.position[2] + 1,
    ]

    try {
      const duplicate = RoofSegmentNodeSchema.parse(duplicateInfo)
      useScene.getState().createNode(duplicate, duplicate.parentId as AnyNodeId)
      setSelection({ selectedIds: [] })
      setMovingNode(duplicate)
    } catch (e) {
      console.error('Failed to duplicate roof segment', e)
    }
  }, [node, setSelection, setMovingNode])

  const handleMove = useCallback(() => {
    if (node) {
      triggerSFX('sfx:item-pick')
      setMovingNode(node)
      setSelection({ selectedIds: [] })
    }
  }, [node, setMovingNode, setSelection])

  const handleDelete = useCallback(() => {
    if (!(selectedId && node)) return
    triggerSFX('sfx:item-delete')
    const parentId = node.parentId
    useScene.getState().deleteNode(selectedId as AnyNodeId)
    if (parentId) {
      useScene.getState().dirtyNodes.add(parentId as AnyNodeId)
      setSelection({ selectedIds: [parentId] })
    } else {
      setSelection({ selectedIds: [] })
    }
  }, [selectedId, node, setSelection])

  if (!(node && node.type === 'roof-segment' && selectedId)) return null

  return (
    <PanelWrapper
      icon="/icons/roof.png"
      onBack={handleBack}
      onClose={handleClose}
      title={node.name || t('nodes.roofSegment.fallbackTitle')}
      width={300}
    >
      <PanelSection title={t('nodes.roofSegment.roofType')}>
        <SegmentedControl
          onChange={(v) => handleUpdate({ roofType: v })}
          options={ROOF_TYPE_OPTIONS}
          value={node.roofType}
        />
        <SegmentedControl
          onChange={(v) => handleUpdate({ roofType: v })}
          options={ROOF_TYPE_OPTIONS_2}
          value={node.roofType}
        />
      </PanelSection>

      <PanelSection title={t('nodes.roofSegment.footprint')}>
        <SliderControl
          label={t('common.width')}
          max={25}
          min={0.5}
          onChange={(v) => handleUpdate({ width: v })}
          precision={2}
          step={0.5}
          unit="m"
          value={Math.round(node.width * 100) / 100}
        />
        <SliderControl
          label={t('common.depth')}
          max={25}
          min={0.5}
          onChange={(v) => handleUpdate({ depth: v })}
          precision={2}
          step={0.5}
          unit="m"
          value={Math.round(node.depth * 100) / 100}
        />
      </PanelSection>

      <PanelSection title={t('nodes.roofSegment.wallHeight')}>
        <SliderControl
          label={t('common.height')}
          max={5}
          min={0}
          onChange={(v) => handleUpdate({ wallHeight: v })}
          precision={2}
          step={0.1}
          unit="m"
          value={Math.round(node.wallHeight * 100) / 100}
        />
      </PanelSection>

      <PanelSection title={t('nodes.roofSegment.pitch')}>
        <SliderControl
          label={t('common.angle')}
          max={60}
          min={0}
          onChange={(v) => handleUpdate({ pitch: v })}
          precision={0}
          step={1}
          unit="°"
          value={Math.round(node.pitch)}
        />
        <div className="flex gap-1.5 px-1 pt-2 pb-1">
          {PITCH_PRESETS.map((preset) => (
            <ActionButton
              key={preset.label}
              label={preset.label}
              onClick={() => handleUpdate({ pitch: preset.deg })}
            />
          ))}
        </div>
      </PanelSection>

      {node.roofType === 'gambrel' && (
        <PanelSection title={t('nodes.roofSegment.shape')}>
          <SliderControl
            label={t('common.depth')}
            max={0.9}
            min={0.1}
            onChange={(v) => handleUpdate({ gambrelLowerWidthRatio: v })}
            precision={2}
            step={0.01}
            unit=""
            value={Math.round(node.gambrelLowerWidthRatio * 100) / 100}
          />
          <SliderControl
            label={t('common.height')}
            max={0.9}
            min={0.1}
            onChange={(v) => handleUpdate({ gambrelLowerHeightRatio: v })}
            precision={2}
            step={0.01}
            unit=""
            value={Math.round(node.gambrelLowerHeightRatio * 100) / 100}
          />
        </PanelSection>
      )}

      {node.roofType === 'mansard' && (
        <PanelSection title={t('nodes.roofSegment.shape')}>
          <SliderControl
            label={t('common.width')}
            max={0.45}
            min={0.05}
            onChange={(v) => handleUpdate({ mansardSteepWidthRatio: v })}
            precision={2}
            step={0.01}
            unit=""
            value={Math.round(node.mansardSteepWidthRatio * 100) / 100}
          />
          <SliderControl
            label={t('common.height')}
            max={0.9}
            min={0.1}
            onChange={(v) => handleUpdate({ mansardSteepHeightRatio: v })}
            precision={2}
            step={0.01}
            unit=""
            value={Math.round(node.mansardSteepHeightRatio * 100) / 100}
          />
        </PanelSection>
      )}

      {node.roofType === 'dutch' && (
        <PanelSection title={t('nodes.roofSegment.shape')}>
          <SliderControl
            label={t('common.width')}
            max={0.45}
            min={0.05}
            onChange={(v) => handleUpdate({ dutchHipWidthRatio: v })}
            precision={2}
            step={0.01}
            unit=""
            value={Math.round(node.dutchHipWidthRatio * 100) / 100}
          />
          <SliderControl
            label={t('common.height')}
            max={0.9}
            min={0.1}
            onChange={(v) => handleUpdate({ dutchHipHeightRatio: v })}
            precision={2}
            step={0.01}
            unit=""
            value={Math.round(node.dutchHipHeightRatio * 100) / 100}
          />
        </PanelSection>
      )}

      <PanelSection title={t('nodes.roofSegment.structure')}>
        <SliderControl
          label={t('common.thickness')}
          max={1}
          min={0.05}
          onChange={(v) => handleUpdate({ wallThickness: v })}
          precision={2}
          step={0.05}
          unit="m"
          value={Math.round(node.wallThickness * 100) / 100}
        />
        <SliderControl
          label={t('nodes.roofSegment.deckThickness')}
          max={0.3}
          min={0.04}
          onChange={(v) => handleUpdate({ deckThickness: v })}
          precision={2}
          step={0.01}
          unit="m"
          value={Math.round(node.deckThickness * 100) / 100}
        />
        <SliderControl
          label={t('nodes.roofSegment.overhang')}
          max={1}
          min={0}
          onChange={(v) => handleUpdate({ overhang: v })}
          precision={2}
          step={0.05}
          unit="m"
          value={Math.round(node.overhang * 100) / 100}
        />
        <SliderControl
          label={t('nodes.roofSegment.shingleThickness')}
          max={0.3}
          min={0.02}
          onChange={(v) => handleUpdate({ shingleThickness: v })}
          precision={2}
          step={0.01}
          unit="m"
          value={Math.round(node.shingleThickness * 100) / 100}
        />
      </PanelSection>

      <PanelSection title={t('common.position')}>
        <SliderControl
          label={t('common.x')}
          max={50}
          min={-50}
          onChange={(v) => {
            const pos = [...node.position] as [number, number, number]
            pos[0] = v
            handleUpdate({ position: pos })
          }}
          precision={2}
          step={0.05}
          unit="m"
          value={Math.round(node.position[0] * 100) / 100}
        />
        <SliderControl
          label={t('common.y')}
          max={50}
          min={-50}
          onChange={(v) => {
            const pos = [...node.position] as [number, number, number]
            pos[1] = v
            handleUpdate({ position: pos })
          }}
          precision={2}
          step={0.05}
          unit="m"
          value={Math.round(node.position[1] * 100) / 100}
        />
        <SliderControl
          label={t('common.z')}
          max={50}
          min={-50}
          onChange={(v) => {
            const pos = [...node.position] as [number, number, number]
            pos[2] = v
            handleUpdate({ position: pos })
          }}
          precision={2}
          step={0.05}
          unit="m"
          value={Math.round(node.position[2] * 100) / 100}
        />
        <SliderControl
          label={t('common.rotation')}
          max={180}
          min={-180}
          onChange={(degrees) => {
            handleUpdate({ rotation: (degrees * Math.PI) / 180 })
          }}
          precision={0}
          step={1}
          unit="°"
          value={Math.round((node.rotation * 180) / Math.PI)}
        />
        <div className="flex gap-1.5 px-1 pt-2 pb-1">
          <ActionButton
            label={t('nodes.stair.rotationPresets.negative')}
            onClick={() => {
              triggerSFX('sfx:item-rotate')
              handleUpdate({ rotation: node.rotation - Math.PI / 4 })
            }}
          />
          <ActionButton
            label={t('nodes.stair.rotationPresets.positive')}
            onClick={() => {
              triggerSFX('sfx:item-rotate')
              handleUpdate({ rotation: node.rotation + Math.PI / 4 })
            }}
          />
        </div>
      </PanelSection>

      <PanelSection title={t('common.actions')}>
        <ActionGroup>
          <ActionButton icon={<Move className="h-3.5 w-3.5" />} label={t('common.move')} onClick={handleMove} />
          <ActionButton
            icon={<Copy className="h-3.5 w-3.5" />}
            label={t('common.duplicate')}
            onClick={handleDuplicate}
          />
          <ActionButton
            className="hover:bg-red-500/20"
            icon={<Trash2 className="h-3.5 w-3.5 text-red-400" />}
            label={t('common.delete')}
            onClick={handleDelete}
          />
        </ActionGroup>
      </PanelSection>
    </PanelWrapper>
  )
}
