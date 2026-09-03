/**
 * GLB → Pascal SceneGraph importer
 *
 * 把 GLB ArrayBuffer 转成一个最小可用的 Pascal SceneGraph,结构:
 *   site (root)
 *   └─ building
 *      └─ level
 *         └─ item  ← GLB mesh 包成一个 item 节点,asset.src 指向外部 URL
 *
 * 为什么这样包:
 *   - applySceneGraphToEditor 要求 rootNodeIds 非空,pascal viewport 默认渲染 site 节点
 *   - item 节点是 pascal 唯一支持外部 asset URL 的节点类型(其他 node 都几何 in-graph)
 *   - asset.dimensions 从 GLB world bbox 算出来,供 3D viewport 按真实尺寸渲染
 *   - 用户在 pascal 加的 wall/door/level 会跟这个 item 节点作为 sibling 加到 site 下
 *
 * 不做什么:
 *   - 不抽 wall/floor/door — 语义错位风险(meshes vs semantic building elements),
 *     用户在 pascal 加 wall/door 是他们的语义决策
 *   - 不解析材质 — pascal 走 scene-material 体系,GLB 内嵌材质无法双向编辑
 *   - 不解析骨骼/动画 — openbim 当前只导静态 GLB
 *
 * 测试: glb-import.test.ts (跟 glb-export.test.ts 同风格,GLTFExporter 自造 GLB)
 */

import {
 type AnyNode,
 type SceneGraph,
 AssetUrl,
 BuildingNode,
 generateId,
 ItemNode,
 LevelNode,
 SiteNode,
} from '@pascal-app/core'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Caller 必须提供的 asset metadata (pascal 不会从 GLB 里 infer 业务信息)
 *
 * @param src     GLB 的可访问 URL (http(s)://)。pascal item 节点 asset.src 必填 URL,
 *                openbim 集成走 http://127.0.0.1:21728/projects/<pid>/files/<fid>/raw
 * @param name    item 节点显示名 (如 'mep-basic__20260903_143847-bcf4.glb')
 * @param category 资产分类 (pascal 端 taxonomy tag,默认 'openbim-glb')
 */
export interface GlbImportOptions {
 src: string
 name: string
 category?: string
}

/**
 * GLB ArrayBuffer → Pascal SceneGraph
 *
 * 抛出:
 *   - src 不是 AssetUrl allowlist (会 throw AssetUrl parse error)
 *   - GLB 解析失败 (invalid magic / GLTFLoader error)
 *   - 解析后 scene 为空 (no children)
 *   - ItemNode / BuildingNode / LevelNode / SiteNode zod parse 失败
 */
export async function glbToSceneGraph(
 glb: ArrayBuffer,
 options: GlbImportOptions,
): Promise<SceneGraph> {
 // 1) 提前校验 src 通过 AssetUrl allowlist (127.0.0.1 / localhost / https / data:image / blob)
 const validatedSrc = AssetUrl.parse(options.src)

 // 2) 解析 GLB
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

 // 3) 算 world bbox,得 asset.dimensions [w, h, d] 和 item.position (bbox 中心)
 const bbox = new THREE.Box3().setFromObject(root)
 const size = new THREE.Vector3()
 bbox.getSize(size)
 const dimensions: [number, number, number] = [
 Math.max(size.x, 1e-6),
 Math.max(size.y, 1e-6),
 Math.max(size.z, 1e-6),
 ]

 const center = new THREE.Vector3()
 bbox.getCenter(center)

 // 4) 构造 4-node wrapper (site → building → level → item)
 const siteId = generateId('site')
 const buildingId = generateId('building')
 const levelId = generateId('level')
 const itemId = generateId('item')

 const site = SiteNode.parse({
 object: 'node',
 id: siteId,
 type: 'site',
 parentId: null,
 visible: true,
 metadata: {},
 children: [buildingId],
 })

 const building = BuildingNode.parse({
 object: 'node',
 id: buildingId,
 type: 'building',
 parentId: siteId,
 visible: true,
 metadata: {},
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
 metadata: {},
 children: [itemId],
 level: 0,
 baseElevation: 0,
 })

 const item = ItemNode.parse({
 object: 'node',
 id: itemId,
 type: 'item',
 parentId: levelId,
 visible: true,
 metadata: {
 // mark GLB-imported items so saveback logic can filter them out
 // (don't export item.asset mesh into the new GLB — only user-added walls)
 openbimGlbImport: true,
 openbimGlbSrc: options.src,
 },
 position: [center.x, center.y, center.z],
 rotation: [0, 0, 0],
 scale: [1, 1, 1],
 children: [],
 asset: {
 id: `openbim-${itemId}`,
 category: options.category ?? 'openbim-glb',
 name: options.name,
 thumbnail: '',
 source: 'library',
 src: validatedSrc,
 dimensions,
 offset: [0, 0, 0],
 rotation: [0, 0, 0],
 scale: [1, 1, 1],
 },
 })

 const nodes: Record<string, AnyNode> = {
 [siteId]: site as unknown as AnyNode,
 [buildingId]: building as unknown as AnyNode,
 [levelId]: level as unknown as AnyNode,
 [itemId]: item as unknown as AnyNode,
 }

 return {
 nodes,
 rootNodeIds: [siteId],
 }
}