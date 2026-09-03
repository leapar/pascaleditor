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
 * Build a single-mesh GLB ArrayBuffer with GLTFExporter (binary mode).
 * Used as the import fixture for glb-import tests.
 */
async function makeGlbArrayBuffer(geometry: THREE.BufferGeometry): Promise<ArrayBuffer> {
 const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#888888' }))
 const root = new THREE.Group()
 root.add(mesh)

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

describe('glbToSceneGraph', () => {
 test('converts a single-mesh GLB into a 4-node scene (site→building→level→item)', async () => {
 const glb = await makeGlbArrayBuffer(new THREE.BoxGeometry(2, 1, 1))
 const graph = await glbToSceneGraph(glb, {
 src: 'http://127.0.0.1:21728/projects/p1/files/f1/raw',
 name: 'test-box.glb',
 category: 'fixture',
 })

 // root: one site
 expect(graph.rootNodeIds).toHaveLength(1)
 const siteId = graph.rootNodeIds[0]
 expect(graph.nodes[siteId]?.type).toBe('site')

 // tree: site → building → level → item
 const site = graph.nodes[siteId]
 expect(site).toBeDefined()
 const buildingId = (site as { children: string[] }).children[0]
 expect(buildingId).toBeDefined()
 const building = graph.nodes[buildingId]
 expect(building?.type).toBe('building')
 const levelId = (building as { children: string[] }).children[0]
 expect(levelId).toBeDefined()
 const level = graph.nodes[levelId]
 expect(level?.type).toBe('level')
 const itemId = (level as { children: string[] }).children[0]
 expect(itemId).toBeDefined()
 const item = graph.nodes[itemId]
 expect(item?.type).toBe('item')

 // item carries the asset URL + dimensions from world bbox
 const itemNode = item as unknown as { asset: { src: string; dimensions: [number, number, number]; name: string } }
 expect(itemNode.asset.src).toBe('http://127.0.0.1:21728/projects/p1/files/f1/raw')
 expect(itemNode.asset.name).toBe('test-box.glb')
 expect(itemNode.asset.dimensions[0]).toBeCloseTo(2, 1)
 expect(itemNode.asset.dimensions[1]).toBeCloseTo(1, 1)
 expect(itemNode.asset.dimensions[2]).toBeCloseTo(1, 1)
 })

 test('rejects URL outside AssetUrl allowlist', async () => {
 const glb = await makeGlbArrayBuffer(new THREE.BoxGeometry(1, 1, 1))
 // ftp:// not in allowlist (https/http/localhost/blob/data:image/asset:// only)
 await expect(
 glbToSceneGraph(glb, {
 src: 'ftp://evil.example.com/x.glb',
 name: 'x.glb',
 }),
 ).rejects.toThrow()
 })

 test('throws on empty GLB (no scene root)', async () => {
 // Empty ArrayBuffer can't be parsed as GLB
 await expect(
 glbToSceneGraph(new ArrayBuffer(0), {
 src: 'http://127.0.0.1:21728/x.glb',
 name: 'x.glb',
 }),
 ).rejects.toThrow()
 })
})