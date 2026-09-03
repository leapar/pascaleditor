import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { glbToSceneGraph } from './glb-import'

// GLTFExporter binary mode uses FileReader for ArrayBuffer→Blob conversion,
// listening on `onloadend` (not onload). Bun doesn't ship a browser-style
// FileReader by default; polyfill with a stub that delegates to Bun's native
// Blob.arrayBuffer() so the GLB bytes are real and round-trippable.
class FileReaderStub {
 public result: ArrayBuffer | string | null = null
 public error: unknown = null
 public onload: ((this: FileReaderStub, ev: ProgressEvent) => unknown) | null = null
 public onloadend: ((this: FileReaderStub, ev: ProgressEvent) => unknown) | null = null
 public onerror: ((this: FileReaderStub, ev: ProgressEvent) => unknown) | null = null
 async readAsArrayBuffer(blob: Blob) {
 try {
 this.result = await blob.arrayBuffer()
 } catch (err) {
 this.error = err
 queueMicrotask(() => this.onerror?.call(this, {} as ProgressEvent))
 return
 }
 queueMicrotask(() => {
 this.onload?.call(this, {} as ProgressEvent)
 this.onloadend?.call(this, {} as ProgressEvent)
 })
 }
}
;(globalThis as { FileReader?: unknown }).FileReader = FileReaderStub

/**
 * Build a GLB ArrayBuffer with GLTFExporter (binary mode) for one or more meshes.
 *
 * NOTE: THREE.BoxGeometry is centered at origin by default, so we shift geometry
 * vertices so world bbox reflects the intended dimensions. This is critical
 * because openbim bonsai exports meshes with bbox.min at the world origin
 * (or wherever the IFC element sits), not centered.
 */
async function makeGlbArrayBuffer(
 meshes: Array<{
 size: [number, number, number]
 ifcClass?: string
 position?: [number, number, number]
 name?: string
}>,
): Promise<ArrayBuffer> {
 const root = new THREE.Group()
 for (const { size, ifcClass, position, name } of meshes) {
 const geometry = new THREE.BoxGeometry(size[0], size[1], size[2])
 // Shift so origin is at min corner: BoxGeometry is centered at (0,0,0)
 geometry.translate(size[0] / 2, size[1] / 2, size[2] / 2)
 const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#888888' }))
 if (name) mesh.name = name
 if (ifcClass) {
 mesh.userData = { extras: { ifc_class: ifcClass } }
 }
 if (position) {
 mesh.position.set(position[0], position[1], position[2])
 }
 root.add(mesh)
 }

 const exporter = new GLTFExporter()
 return await new Promise<ArrayBuffer>((resolve, reject) => {
 exporter.parse(
 root,
 (gltf) => resolve(gltf as ArrayBuffer),
 (err) => reject(err instanceof Error ? err : new Error(String(err))),
 { binary: true },
 )
 })
}

function byType(nodes: Record<string, unknown>, type: string): Array<{ id: string; node: Record<string, unknown> }> {
 const out: Array<{ id: string; node: Record<string, unknown> }> = []
 for (const [id, node] of Object.entries(nodes)) {
 const n = node as Record<string, unknown>
 if (n.type === type) out.push({ id, node: n })
 }
 return out
}

describe('glbToSceneGraph (M8.2 decompose)', () => {
 test('empty GLB ArrayBuffer throws', async () => {
 await expect(glbToSceneGraph(new ArrayBuffer(0), { name: 'empty.glb' })).rejects.toThrow()
 })

 test('root is always a single site node', async () => {
 const glb = await makeGlbArrayBuffer([
 { size: [1, 1, 1], ifcClass: 'IfcSlab' },
 ])
 const graph = await glbToSceneGraph(glb, { name: 's.glb' })
 expect(graph.rootNodeIds).toHaveLength(1)
 const siteId = graph.rootNodeIds[0]!
 const site = graph.nodes[siteId] as { type: string } | undefined
 expect(site?.type).toBe('site')
 })

 test('4-node wrapper: site → building → level with proper parent links', async () => {
 const glb = await makeGlbArrayBuffer([
 { size: [3, 2.5, 0.2], ifcClass: 'IfcWallStandardCase' },
 ])
 const graph = await glbToSceneGraph(glb, { name: 's.glb' })
 const siteId = graph.rootNodeIds[0]!
 const site = graph.nodes[siteId] as { children: string[]; name?: string }
 expect(site.name).toBe('s.glb')
 expect(site.children).toHaveLength(1)
 const buildingId = site.children[0]!
 const building = graph.nodes[buildingId] as { type: string; children: string[]; parentId: string }
 expect(building.type).toBe('building')
 expect(building.parentId).toBe(siteId)
 expect(building.children).toHaveLength(1)
 const levelId = building.children[0]!
 const level = graph.nodes[levelId] as { type: string; children: string[]; parentId: string }
 expect(level.type).toBe('level')
 expect(level.parentId).toBe(buildingId)
 })

 test('wall mesh → WallNode with axis-aligned start/end/thickness/height', async () => {
 const glb = await makeGlbArrayBuffer([
 { size: [3, 2.5, 0.2], ifcClass: 'IfcWallStandardCase' },
 ])
 const graph = await glbToSceneGraph(glb, { name: 's.glb' })
 const walls = byType(graph.nodes, 'wall')
 expect(walls).toHaveLength(1)
 const wall = walls[0]!.node as {
 start: [number, number]
 end: [number, number]
 thickness: number
 height: number
 metadata: Record<string, unknown>
 }
 // X-axis wall: start (0,0), end (3,0), thickness 0.2, height 2.5
 expect(wall.start[0]).toBeCloseTo(0, 6)
 expect(wall.start[1]).toBeCloseTo(0, 6)
 expect(wall.end[0]).toBeCloseTo(3, 6)
 expect(wall.thickness).toBeCloseTo(0.2, 6)
 expect(wall.height).toBeCloseTo(2.5, 6)
 expect(wall.metadata.openbimGlbImport).toBe(true)
 expect(wall.metadata.openbimImportKind).toBe('wall')
 })

 test('slab mesh → SlabNode with polygon / elevation / thickness', async () => {
 const glb = await makeGlbArrayBuffer([
 { size: [10, 0.1, 8], ifcClass: 'IfcSlab' },
 ])
 const graph = await glbToSceneGraph(glb, { name: 's.glb' })
 const slabs = byType(graph.nodes, 'slab')
 expect(slabs).toHaveLength(1)
 const slab = slabs[0]!.node as {
 polygon: Array<[number, number]>
 elevation: number
 thickness: number
 metadata: Record<string, unknown>
 }
 expect(slab.polygon).toHaveLength(4)
 expect(slab.thickness).toBeCloseTo(0.1, 6)
 // BoxGeometry 10x0.1x8 → after translate, bbox y=0..0.1 → max.y = 0.1
 expect(slab.elevation).toBeCloseTo(0.1, 6)
 expect(slab.metadata.openbimImportKind).toBe('slab')
 })

 test('door on wall → DoorNode with wallId set + position in wall-local coords', async () => {
 // wall 3m along X (Y-up, Z thickness 0.2), door at world x=1.5 (centered), 0.6 wide x 2.1 tall x 0.1 thick
 const glb = await makeGlbArrayBuffer([
 { size: [3, 2.5, 0.2], ifcClass: 'IfcWallStandardCase' },
 { size: [0.6, 2.1, 0.1], ifcClass: 'IfcDoor', position: [1.2, 0, -0.05] },
 ])
 const graph = await glbToSceneGraph(glb, { name: 's.glb' })
 const doors = byType(graph.nodes, 'door')
 expect(doors).toHaveLength(1)
 const door = doors[0]!.node as {
 wallId?: string
 position: [number, number, number]
 width: number
 height: number
 metadata: Record<string, unknown>
 }
 const walls = byType(graph.nodes, 'wall')
 const wallId = walls[0]!.id
 expect(door.wallId).toBe(wallId)
 // door center at world x=1.5 (after position + size/2), wall length 3 → u=0.5 → uMeters = 1.5
 expect(door.position[0]).toBeCloseTo(1.5, 6)
 // door height/2 = 1.05
 expect(door.position[1]).toBeCloseTo(1.05, 6)
 expect(door.width).toBeCloseTo(0.6, 6)
 expect(door.height).toBeCloseTo(2.1, 6)
 expect(door.metadata.openbimImportKind).toBe('door')

 // door should appear in wall.children (pascal wall-system renders attached openings)
 const wall = walls[0]!.node as { children: string[] }
 expect(wall.children).toContain(door.id)
 })

 test('window on wall → WindowNode with wallId + sill-positioned center', async () => {
 const glb = await makeGlbArrayBuffer([
 { size: [3, 2.5, 0.2], ifcClass: 'IfcWallStandardCase' },
 { size: [1.5, 1.5, 0.1], ifcClass: 'IfcWindow', position: [0.75, 0, -0.05] },
 ])
 const graph = await glbToSceneGraph(glb, { name: 's.glb' })
 const windows = byType(graph.nodes, 'window')
 expect(windows).toHaveLength(1)
 const win = windows[0]!.node as {
 wallId?: string
 position: [number, number, number]
 width: number
 height: number
 }
 const walls = byType(graph.nodes, 'wall')
 expect(win.wallId).toBe(walls[0]!.id)
 // window center at world x=1.5 (after position 0.75 + size 1.5/2), u=0.5 → uMeters = 1.5
 expect(win.position[0]).toBeCloseTo(1.5, 6)
 // window sill 0.9 + height/2 0.75 = 1.65
 expect(win.position[1]).toBeCloseTo(1.65, 6)
 expect(win.width).toBeCloseTo(1.5, 6)
 })

 test('door far from any wall (distance > 1m) → orphan door, no wallId', async () => {
 // door at x=20 (17m from wall end) — way outside 1m tolerance
 const glb = await makeGlbArrayBuffer([
 { size: [3, 2.5, 0.2], ifcClass: 'IfcWallStandardCase' },
 { size: [0.6, 2.1, 0.1], ifcClass: 'IfcDoor', position: [20, 0, 0] },
 ])
 const graph = await glbToSceneGraph(glb, { name: 's.glb' })
 const doors = byType(graph.nodes, 'door')
 expect(doors).toHaveLength(1)
 const door = doors[0]!.node as { wallId?: string }
 expect(door.wallId).toBeUndefined()
 })

 test('unknown ifc_class (IfcPipeSegment / furniture) → ItemNode fallback', async () => {
 const glb = await makeGlbArrayBuffer([
 { size: [0.1, 0.1, 3], ifcClass: 'IfcPipeSegment' },
 ])
 const graph = await glbToSceneGraph(glb, { name: 's.glb' })
 const items = byType(graph.nodes, 'item')
 expect(items).toHaveLength(1)
 const item = items[0]!.node as {
 asset: { category: string; name: string }
 metadata: Record<string, unknown>
 }
 expect(item.metadata.openbimImportKind).toBe('fallback-item')
 expect(item.metadata.openbimOriginalIfcClass).toBe('IfcPipeSegment')
 expect(item.asset.category).toBe('IfcPipeSegment')
 })

 test('mesh with no ifc_class (third-party GLB) → ItemNode fallback', async () => {
 const glb = await makeGlbArrayBuffer([
 { size: [1, 1, 1] },
 ])
 const graph = await glbToSceneGraph(glb, { name: 's.glb' })
 const items = byType(graph.nodes, 'item')
 expect(items).toHaveLength(1)
 const item = items[0]!.node as { metadata: Record<string, unknown> }
 expect(item.metadata.openbimImportKind).toBe('fallback-item')
 expect(item.metadata.openbimOriginalIfcClass).toBeNull()
 })

 test('IfcWall and IfcWallStandardCase both → WallNode', async () => {
 const glb = await makeGlbArrayBuffer([
 { size: [3, 2.5, 0.2], ifcClass: 'IfcWall' },
 { size: [0.2, 2.5, 4], ifcClass: 'IfcWallStandardCase' },
 ])
 const graph = await glbToSceneGraph(glb, { name: 's.glb' })
 const walls = byType(graph.nodes, 'wall')
 expect(walls).toHaveLength(2)
 })

 test('full building: 2 walls + 1 slab + 1 door + 1 window → 8 nodes', async () => {
 const glb = await makeGlbArrayBuffer([
 { size: [3, 2.5, 0.2], ifcClass: 'IfcWallStandardCase' },
 { size: [0.2, 2.5, 3], ifcClass: 'IfcWall' },
 { size: [10, 0.1, 8], ifcClass: 'IfcSlab' },
 { size: [0.6, 2.1, 0.1], ifcClass: 'IfcDoor', position: [1.2, 0, -0.05] },
 { size: [1.5, 1.5, 0.1], ifcClass: 'IfcWindow', position: [0.75, 0, 0.05] },
 ])
 const graph = await glbToSceneGraph(glb, { name: 'building.glb' })
 expect(byType(graph.nodes, 'wall')).toHaveLength(2)
 expect(byType(graph.nodes, 'slab')).toHaveLength(1)
 expect(byType(graph.nodes, 'door')).toHaveLength(1)
 expect(byType(graph.nodes, 'window')).toHaveLength(1)
 // site/building/level + 2 walls + 1 slab + 1 door + 1 window = 8
 expect(Object.keys(graph.nodes)).toHaveLength(8)
 })

 test('preserves GLB mesh.name on decomposed nodes (sidebar label + debug metadata)', async () => {
 // Simulate openbim bonsai_load output: mesh.name carries IFC entity Name (含 system/wall 后缀),
 // mesh.userData.extras.ifc_class carries IFC class. 验证 pascal 端原样保留,sidebar 能直接看到
 // "Wall_0_0_interior" / "RoofSlab" / "Pipe_0_water_supply" 跟 GLB 一一对应。
 const glb = await makeGlbArrayBuffer([
 { size: [5, 2.8, 0.24], ifcClass: 'IfcWallStandardCase', name: 'Wall_0_0_interior' },
 { size: [5, 2.8, 0.24], ifcClass: 'IfcWallStandardCase', name: 'Wall_1_0_interior' },
 { size: [5, 0.15, 4], ifcClass: 'IfcSlab', name: 'FloorSlab' },
 { size: [5, 0.12, 4], ifcClass: 'IfcSlab', name: 'RoofSlab' },
 { size: [4.02, 0.02, 0.02], ifcClass: 'IfcPipeSegment', name: 'Pipe_0_water_supply' },
 ])
 const graph = await glbToSceneGraph(glb, { name: 'mep-basic.glb' })

 // Wall 节点: name + metadata.openbimOriginalName 都等于 mesh.name
 const walls = byType(graph.nodes, 'wall')
 expect(walls).toHaveLength(2)
 for (const { node } of walls) {
 expect(node.name).toBeTruthy()
 expect(node.name).toMatch(/^Wall_\d+_0_interior$/)
 const meta = node.metadata as { openbimOriginalName?: string }
 expect(meta.openbimOriginalName).toBe(node.name)
 }

 // Slab 节点: FloorSlab / RoofSlab 都在 sidebar 直接显示
 const slabs = byType(graph.nodes, 'slab')
 expect(slabs).toHaveLength(2)
 const slabNames = slabs.map((s) => s.node.name).sort()
 expect(slabNames).toEqual(['FloorSlab', 'RoofSlab'])
 for (const { node } of slabs) {
 const meta = node.metadata as { openbimOriginalName?: string }
 expect(meta.openbimOriginalName).toBe(node.name)
 }

 // ItemNode fallback (MEP): 同样保留 mesh.name
 const items = byType(graph.nodes, 'item')
 expect(items).toHaveLength(1)
 expect(items[0]!.node.name).toBe('Pipe_0_water_supply')
 const itemMeta = items[0]!.node.metadata as { openbimOriginalName?: string }
 expect(itemMeta.openbimOriginalName).toBe('Pipe_0_water_supply')
 })
})
