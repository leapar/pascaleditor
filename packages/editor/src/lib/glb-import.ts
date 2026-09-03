/**
 * GLB → Pascal SceneGraph importer
 *
 * 把 openbim 导出的 GLB ArrayBuffer 转成 Pascal SceneGraph。
 *
 * M8.2 拆解策略（用户决策）：
 *   - GLB 里的每个 mesh 在 [openbim bonsai_load.py:245-248](openbim/pyapp/openbim/blender/bonsai_load.py#L245-L248)
 *     已经被 stamp 了 `ifc_class`（userData.ifc_class in glTF node.extras）。
 *   - pascal 侧读 mesh.userData.ifc_class，按 IFC class 分发到 4 个 emit 函数：
 *       IfcWall / IfcWallStandardCase → WallNode
 *       IfcSlab                       → SlabNode
 *       IfcDoor                       → DoorNode（parent wallId 由 proximity matching 决定）
 *       IfcWindow                     → WindowNode（同 door）
 *   - 其他（IfcPipeSegment / IfcCableSegment / IfcDuctSegment / IfcPipeFitting
 *     等 MEP 类，pascal 没有对应节点类型）→ ItemNode fallback 单节点。
 *   - 没有 ifc_class 的 mesh（第三方 GLB）→ ItemNode fallback。
 *
 * SceneGraph 结构：
 *   site (root)
 *   └─ building
 *      └─ level
 *         ├─ wall_1
 *         ├─ wall_2
 *         ├─ slab_1
 *         ├─ door_1 (children of nearest wall)
 *         ├─ window_1 (children of nearest wall)
 *         └─ item_* (MEP / furniture fallback)
 *
 * 不做什么：
 *   - 不解析材质 — pascal 走 scene-material 体系，GLB 内嵌材质无法双向编辑
 *   - 不解析骨骼/动画 — openbim 当前只导静态 GLB
 *   - 不改 wall-system / slab-system / door-system / window-system — 它们按 SceneGraph 工作，新节点自动 rebuild
 *   - 不改 saveback 机制 — 每个 emit 出来的节点都带 `metadata.openbimGlbImport: true`，
 *     glb-export.ts 端已有过滤逻辑（fallback item 保留，拆解后的 wall/slab 不重复导出）
 *
 * 测试：glb-import.test.ts (跟 glb-export.test.ts 同风格，GLTFExporter 自造 GLB)
 */

import {
 type AnyNode,
 type SceneGraph,
 BuildingNode,
 DoorNode,
 generateId,
 ItemNode,
 LevelNode,
 SiteNode,
 SlabNode,
 WallNode,
 WindowNode,
} from '@pascal-app/core'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
 doorOrWindowGeometryFromBox,
 projectOntoWall,
 slabGeometryFromBox,
 wallGeometryFromBox,
} from './glb-mesh-geometry'

/**
 * 拆解选项
 *
 * @param name scene 显示名 (如 'mep-basic__20260903_143847-bcf4.glb')
 */
export interface GlbImportOptions {
 name: string
}

/** Wall 几何参数（拆解后用于 door/window proximity matching + 投影） */
interface WallGeometry {
 start: [number, number]
 end: [number, number]
 thickness: number
 height: number
}

/** Door/Window mesh 的中转结构 */
interface OpeningMesh {
 mesh: THREE.Mesh
 kind: 'door' | 'window'
 ifcClass: string
}

/**
 * GLB ArrayBuffer → Pascal SceneGraph
 *
 * 抛出：
 *   - GLB 解析失败 (invalid magic / GLTFLoader error)
 *   - 解析后 scene 为空 (no children)
 *   - 拆解出的 WallNode / SlabNode / ... zod parse 失败
 */
export async function glbToSceneGraph(
 glb: ArrayBuffer,
 options: GlbImportOptions,
): Promise<SceneGraph> {
 // 1) 解析 GLB
 const loader = new GLTFLoader()
 const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
 loader.parse(
 glb,
 '',
 (parsed) => resolve(parsed),
 (err) => reject(err instanceof Error ? err : new Error(String(err))),
 )
 })

 const root = gltf.scene
 if (!root) {
 throw new Error('GLB 无根节点(scene 缺失)')
 }

 // 2) 第一遍：emit wall / slab + 收集 door/window 待办
 const wallNodes: Record<string, WallNode> = {}
 const wallGeometryById: Record<string, WallGeometry> = {}
 const slabNodes: Record<string, SlabNode> = {}
 const openingQueue: OpeningMesh[] = []
 const fallbackItemNodes: Record<string, ItemNode> = {}

 const meshes = collectMeshes(root)
 for (const mesh of meshes) {
 const ifcClass = readIfcClass(mesh)

 if (isWallClass(ifcClass)) {
 const { node, geometry } = emitWallNode(mesh, ifcClass)
 wallNodes[node.id] = node
 wallGeometryById[node.id] = geometry
 } else if (ifcClass === 'IfcSlab') {
 const node = emitSlabNode(mesh, ifcClass)
 slabNodes[node.id] = node
 } else if (ifcClass === 'IfcDoor') {
 openingQueue.push({ mesh, kind: 'door', ifcClass })
 } else if (ifcClass === 'IfcWindow') {
 openingQueue.push({ mesh, kind: 'window', ifcClass })
 } else {
 const node = emitItemFallback(mesh, ifcClass, options.name)
 fallbackItemNodes[node.id] = node
 }
 }

 // 3) 第二遍：emit door/window — proximity matching + wall-local 投影
 const doorNodes: Record<string, DoorNode> = {}
 const windowNodes: Record<string, WindowNode> = {}

 for (const opening of openingQueue) {
 const match = findNearestWall(opening.mesh, wallGeometryById)

 if (opening.kind === 'door') {
 const node = emitDoorNode(opening.mesh, match, opening.ifcClass)
 doorNodes[node.id] = node
 } else {
 const node = emitWindowNode(opening.mesh, match, opening.ifcClass)
 windowNodes[node.id] = node
 }
 }

 // 4) 把 door/window 的 id 挂到 parent wall.children（pascal wall-system 渲染 attached openings）
 //    如果 parentWallId 为 null（orphan），挂在 level.children 下，sidebar 仍显示
 const orphanDoorIds: string[] = []
 const orphanWindowIds: string[] = []

 for (const door of Object.values(doorNodes)) {
 if (door.wallId) {
 const wall = wallNodes[door.wallId]
 if (wall) {
 wall.children.push(door.id)
 continue
 }
 }
 orphanDoorIds.push(door.id)
 }
 for (const win of Object.values(windowNodes)) {
 if (win.wallId) {
 const wall = wallNodes[win.wallId]
 if (wall) {
 wall.children.push(win.id)
 continue
 }
 }
 orphanWindowIds.push(win.id)
 }

 // 5) 构造 4-node wrapper (site → building → level)
 const siteId = generateId('site')
 const buildingId = generateId('building')
 const levelId = generateId('level')

 const levelChildIds = [
 ...Object.keys(wallNodes),
 ...Object.keys(slabNodes),
 ...orphanDoorIds,
 ...orphanWindowIds,
 ...Object.keys(fallbackItemNodes),
 ]

 const site = SiteNode.parse({
 object: 'node',
 id: siteId,
 type: 'site',
 parentId: null,
 visible: true,
 name: options.name,
 metadata: {
 openbimGlbImport: true,
 openbimImportKind: 'site',
 },
 children: [buildingId],
 })

 const building = BuildingNode.parse({
 object: 'node',
 id: buildingId,
 type: 'building',
 parentId: siteId,
 visible: true,
 metadata: {
 openbimGlbImport: true,
 openbimImportKind: 'building',
 },
 children: [levelId],
 position: [0, 0, 0],
 rotation: [0, 0, 0],
 })

 const level = LevelNode.parse({
 object: 'node',
 id: levelId,
 type: 'level',
 parentId: buildingId,
 visible: true,
 metadata: {
 openbimGlbImport: true,
 openbimImportKind: 'level',
 },
 children: levelChildIds,
 level: 0,
 baseElevation: 0,
 })

 const nodes: Record<string, AnyNode> = {
 [siteId]: site as unknown as AnyNode,
 [buildingId]: building as unknown as AnyNode,
 [levelId]: level as unknown as AnyNode,
 ...(wallNodes as Record<string, AnyNode>),
 ...(slabNodes as Record<string, AnyNode>),
 ...(doorNodes as Record<string, AnyNode>),
 ...(windowNodes as Record<string, AnyNode>),
 ...(fallbackItemNodes as Record<string, AnyNode>),
 }

 return {
 nodes,
 rootNodeIds: [siteId],
 }
}

// ====== helpers ======

/** 递归收集所有 THREE.Mesh */
function collectMeshes(node: THREE.Object3D): THREE.Mesh[] {
 const meshes: THREE.Mesh[] = []
 node.traverse((o) => {
 if (o instanceof THREE.Mesh) meshes.push(o)
 })
 return meshes
}

/**
 * 读 mesh 的 ifc_class 元数据
 *
 * glTF 把 bpy Object custom props 写到 node.extras (export_extras=True)。
 * GLTFLoader 解析后 extras 会落到 mesh.userData.extras.ifc_class
 * （GLTFLoader parse 时把 extras 放进 userData.extras，参见 three GLTFLoader.parse 源码）。
 */
function readIfcClass(mesh: THREE.Mesh): string | null {
 const userData = mesh.userData as Record<string, unknown>

 // 路径 1: userData.extras.ifc_class（GLTFLoader 标准 extras 路径）
 const fromExtras = userData.extras as Record<string, unknown> | undefined
 const c1 = fromExtras?.ifc_class
 if (typeof c1 === 'string') return c1

 // 路径 2: userData.ifc_class（fallback，有些 GLB 直接挂在 userData）
 const c2 = userData.ifc_class
 if (typeof c2 === 'string') return c2

 return null
}

function isWallClass(ifcClass: string | null): boolean {
 return ifcClass === 'IfcWall' || ifcClass === 'IfcWallStandardCase'
}

// ====== emit functions ======

/**
 * Emit WallNode from mesh (Y-up world coords from openbim bonsai)
 *
 * Returns:
 *   - node: WallNode (zod-validated)
 *   - geometry: 原始几何参数（start/end/thickness/height），用于第二遍 door/window 投影
 */
function emitWallNode(
 mesh: THREE.Mesh,
 ifcClass: string | null,
): { node: WallNode; geometry: WallGeometry } {
 const bbox = new THREE.Box3().setFromObject(mesh)
 const geom = wallGeometryFromBox(bbox)

 const id = generateId('wall')
 const node = WallNode.parse({
 object: 'node',
 id,
 type: 'wall',
 parentId: null,
 name: mesh.name || undefined,
 visible: true,
 metadata: {
 openbimGlbImport: true,
 openbimImportKind: 'wall',
 openbimOriginalIfcClass: ifcClass ?? 'IfcWallStandardCase',
 openbimOriginalName: mesh.name || null,
 },
 children: [],
 start: geom.start,
 end: geom.end,
 thickness: geom.thickness,
 height: geom.height,
 frontSide: 'unknown',
 backSide: 'unknown',
 })

 return { node, geometry: geom }
}

function emitSlabNode(mesh: THREE.Mesh, ifcClass: string | null): SlabNode {
 const bbox = new THREE.Box3().setFromObject(mesh)
 const geom = slabGeometryFromBox(bbox)

 const id = generateId('slab')
 return SlabNode.parse({
 object: 'node',
 id,
 type: 'slab',
 parentId: null,
 name: mesh.name || undefined,
 visible: true,
 metadata: {
 openbimGlbImport: true,
 openbimImportKind: 'slab',
 openbimOriginalIfcClass: ifcClass ?? 'IfcSlab',
 openbimOriginalName: mesh.name || null,
 },
 children: [],
 polygon: geom.polygon,
 elevation: geom.elevation,
 thickness: geom.thickness,
 })
}

/**
 * Emit DoorNode from mesh + matched wall geometry
 *
 * match: 由 findNearestWall 返回的 (wallId, geometry) 或 null（orphan）
 */
function emitDoorNode(
 mesh: THREE.Mesh,
 match: { wallId: string; geometry: WallGeometry } | null,
 ifcClass: string,
): DoorNode {
 const id = generateId('door')
 const bbox = new THREE.Box3().setFromObject(mesh)
 let position: [number, number, number] = [0, 1.05, 0]
 let width = 0.9
 let height = 2.1

 if (match) {
 const geo = doorOrWindowGeometryFromBox(bbox, match.geometry.start, match.geometry.end)
 position = geo.position
 width = geo.width
 height = geo.height
 }

 return DoorNode.parse({
 object: 'node',
 id,
 type: 'door',
 parentId: null,
 name: mesh.name || undefined,
 visible: true,
 metadata: {
 openbimGlbImport: true,
 openbimImportKind: 'door',
 openbimOriginalIfcClass: ifcClass,
 openbimOriginalName: mesh.name || null,
 },
 children: [],
 position,
 width,
 height,
 wallId: match?.wallId,
 })
}

/** 同 emitDoorNode，但 height/position 按 window sill 默认值 */
function emitWindowNode(
 mesh: THREE.Mesh,
 match: { wallId: string; geometry: WallGeometry } | null,
 ifcClass: string,
): WindowNode {
 const id = generateId('window')
 const bbox = new THREE.Box3().setFromObject(mesh)
 let position: [number, number, number] = [0, 1.5, 0]
 let width = 1.5
 let height = 1.5

 if (match) {
 const geo = doorOrWindowGeometryFromBox(bbox, match.geometry.start, match.geometry.end)
 // window 中心 v = sill + height/2，但 doorOrWindowGeometryFromBox 返回的
 // position[1] = height/2（按 0 起点）。window 真实中点应该往上偏 sillHeight
 const sillHeight = 0.9
 position = [geo.position[0], sillHeight + geo.height / 2, geo.position[2]]
 width = geo.width
 height = geo.height
 }

 return WindowNode.parse({
 object: 'node',
 id,
 type: 'window',
 parentId: null,
 name: mesh.name || undefined,
 visible: true,
 metadata: {
 openbimGlbImport: true,
 openbimImportKind: 'window',
 openbimOriginalIfcClass: ifcClass,
 openbimOriginalName: mesh.name || null,
 },
 children: [],
 position,
 width,
 height,
 wallId: match?.wallId,
 })
}

/**
 * Emit ItemNode fallback (MEP / 第三方 GLB / 无 ifc_class)
 *
 * 把 mesh 包成一个 item 节点，asset.src 用 inline data URL（避免依赖外部 URL）
 * — openbim 集成场景下，pascal 不会 re-fetch 这个 fallback item（拆解已经把
 * wall/slab/door/window 都还原了）。
 */
function emitItemFallback(
 mesh: THREE.Mesh,
 ifcClass: string | null,
 glbName: string,
): ItemNode {
 const bbox = new THREE.Box3().setFromObject(mesh)
 const size = new THREE.Vector3()
 bbox.getSize(size)
 const center = new THREE.Vector3()
 bbox.getCenter(center)

 const id = generateId('item')
 return ItemNode.parse({
 object: 'node',
 id,
 type: 'item',
 parentId: null,
 name: mesh.name || undefined,
 visible: true,
 metadata: {
 openbimGlbImport: true,
 openbimImportKind: 'fallback-item',
 openbimOriginalIfcClass: ifcClass,
 openbimOriginalName: mesh.name || null,
 },
 children: [],
 position: [center.x, center.y, center.z],
 rotation: [0, 0, 0],
 scale: [1, 1, 1],
 asset: {
 id: `openbim-fallback-${id}`,
 category: ifcClass ?? 'openbim-glb',
 name: `${glbName} (${ifcClass ?? 'unknown'})`,
 thumbnail: '',
 source: 'library',
 src: 'asset://openbim-fallback-placeholder' as never, // 占位 URL，viewport 不会 re-fetch
 dimensions: [
 Math.max(size.x, 1e-6),
 Math.max(size.y, 1e-6),
 Math.max(size.z, 1e-6),
 ],
 offset: [0, 0, 0],
 rotation: [0, 0, 0],
 scale: [1, 1, 1],
 },
 })
}

// ====== proximity matching ======

/** Door/Window → 最近 wall 的 (id, geometry)。XZ 平面 1m 容差，超容差返回 null */
function findNearestWall(
 mesh: THREE.Mesh,
 walls: Record<string, WallGeometry>,
): { wallId: string; geometry: WallGeometry } | null {
 const bbox = new THREE.Box3().setFromObject(mesh)
 const center = new THREE.Vector3()
 bbox.getCenter(center)

 let best: { wallId: string; geometry: WallGeometry; distance: number } | null = null

 for (const [wallId, geom] of Object.entries(walls)) {
 const proj = projectOntoWall(
 { x: center.x, z: center.z },
 geom.start,
 geom.end,
 )
 if (best === null || proj.distance < best.distance) {
 best = { wallId, geometry: geom, distance: proj.distance }
 }
 }

 // 1m 容差（半面墙的厚度 + 余量；openbim 门/窗一定贴墙）
 if (best === null || best.distance > 1.0) return null
 return { wallId: best.wallId, geometry: best.geometry }
}
