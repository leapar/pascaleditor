/**
 * GLB mesh → Pascal node 参数转换 (纯函数,便于单测)
 *
 * 坐标系约定 (openbim M5+):
 *   - ifcopenshell.geom 输出已是 Y-up ([bonsai_load.py:316-318]):
 *     - X = 沿墙/管方向 (主轴)
 *     - Y = up (垂直高度方向)
 *     - Z = 副轴 (墙的厚度 / 管的半径方向)
 *   - pascal level plane = XZ (Y up) — wall-system.tsx: wallStart = { x: start[0], y: start[1] }
 *     其中 y 是 2D plane 上的"第二个轴",实际对应 world Z
 *   - 因此映射: world (X, Y, Z) → level plane ([X, Z]) + vertical (Y=up)
 *
 * Wall/Door/Window 都没问题 (单一方向)。Slab 较复杂: 楼层板是 XY-plane 矩形在 Y 方向
 * 薄薄一层,所以 level 坐标上 polygon = (X, Z) 4 角,elevation = top of slab in Y。
 *
 * 测试: glb-mesh-geometry.test.ts (同目录)
 */

import * as THREE from 'three'

/**
 * Wall mesh: 从 world Box3 推算 start / end / thickness / height
 *
 * 输入约定: 墙的 bbox 必须 axis-aligned (openbim bonsai_load.py 用
 * ifcopenshell.geom 输出已经是 world-coords,所以 mesh.geometry.boundingBox
 * 反映真实墙的三个维度)。
 *
 * 算法:
 *   - Y (up) 方向跨度 = height
 *   - X/Z 两个水平方向: 长轴 = 墙方向,短轴 = 厚度
 *   - start/end 取墙方向两端 (短轴取 min)
 *
 * 边界:
 *   - 非 axis-aligned 墙 (旋转后 mesh.matrix 不为单位) → 返回的 start/end 仍是
 *     bbox 投影,会"覆盖"实际墙长;用户后续可在 pascal 调 handle 精确化。
 *     (openbim 输出的 GLB 都是 axis-aligned,这个 fallback 极少触发)
 */
export function wallGeometryFromBox(box: THREE.Box3): {
 start: [number, number]
 end: [number, number]
 thickness: number
 height: number
 /** 墙方向在水平面的单位向量 (用于 door/window 投影) */
 direction: [number, number]
} {
 const dx = box.max.x - box.min.x
 const dy = box.max.y - box.min.y
 const dz = box.max.z - box.min.z

 const height = Math.max(dy, 1e-6)

 let start: [number, number]
 let end: [number, number]
 let direction: [number, number]
 let thickness: number

 if (dx >= dz) {
 // wall along X axis (most common)
 start = [box.min.x, box.min.z]
 end = [box.max.x, box.min.z]
 direction = [1, 0]
 thickness = Math.max(dz, 1e-6)
 } else {
 // wall along Z axis
 start = [box.min.x, box.min.z]
 end = [box.min.x, box.max.z]
 direction = [0, 1]
 thickness = Math.max(dx, 1e-6)
 }

 return { start, end, thickness, height, direction }
}

/**
 * Slab mesh: 从 world Box3 推算 polygon (CCW) / elevation / thickness
 *
 * SlabNode.polygon 是逆时针 2D 点列 (XZ 平面)。
 * elevation = slab 顶面高度 (pascal walking surface)
 * thickness = 从 elevation 向下到 slab 底面的厚度
 *
 * 简化假设:
 *   - 楼板是 axis-aligned 矩形 (openbim 输出的 IfcSlab 多为此)
 *   - 非矩形 (L 形 / 凹多边形) → 返回的 polygon 仍是 bbox 4 角,会有"溢出",
 *     caller 应检查 mesh.geometry 是否非矩形并 fallback
 */
export function slabGeometryFromBox(box: THREE.Box3): {
 polygon: Array<[number, number]>
 elevation: number
 thickness: number
} {
 const polygon: Array<[number, number]> = [
 // CCW in XZ plane (looking down from +Y)
 [box.min.x, box.min.z],
 [box.max.x, box.min.z],
 [box.max.x, box.max.z],
 [box.min.x, box.max.z],
 ]

 const elevation = box.max.y
 const thickness = Math.max(box.max.y - box.min.y, 1e-6)

 return { polygon, elevation, thickness }
}

/**
 * Door/Window mesh: 在 wall 上找最近的点 + 计算 wall-local (u, v, perp) 坐标
 *
 * 输入:
 *   - point: door/window mesh 的世界中心点 (XZ 投影)
 *   - wallStart / wallEnd: 墙 start/end 的 [x, z]
 *   - wallThickness: 墙的厚度 (用于 v / perp 判断)
 *
 * 输出:
 *   - u: 沿墙方向 (0 = start, 1 = end),在 door/window 中心点处
 *   - perp: 垂直于墙方向的距离 (用于判断 door 在墙的哪一面)
 *   - distance: 中心到墙 line 的垂直距离 (用来判断 door 是否"贴墙")
 *
 * 算法:
 *   - 把 point 投影到 wallStart→wallEnd 线段,参数 u ∈ [0, 1]
 *   - 越界 (u < 0 或 u > 1) → 投影到最近端点, distance = 端点到 point 距离
 *   - distance > maxAttachDistance → caller 应认为 door 不属于这面墙
 */
export function projectOntoWall(
 point: { x: number; z: number },
 wallStart: [number, number],
 wallEnd: [number, number],
): { u: number; perpSigned: number; distance: number; closest: [number, number] } {
 const sx = wallStart[0], sz = wallStart[1]
 const ex = wallEnd[0], ez = wallEnd[1]

 const dx = ex - sx
 const dz = ez - sz
 const lenSq = dx * dx + dz * dz

 if (lenSq < 1e-12) {
 // degenerate wall (start == end)
 return {
 u: 0,
 perpSigned: 0,
 distance: Math.hypot(point.x - sx, point.z - sz),
 closest: [sx, sz],
 }
 }

 // Wall direction unit vector
 const wx = dx / Math.sqrt(lenSq)
 const wz = dz / Math.sqrt(lenSq)

 // Perp direction (rotated 90° CCW in XZ plane when looking down from +Y).
 // Convention: for wall direction +X, perp = +Z.
 // Pascal uses perpSigned only as a consistency check (door inside wall thickness);
 // the sign itself doesn't matter, only internal consistency.
 const px = -wz
 const pz = wx

 // Vector from wallStart to point
 const vx = point.x - sx
 const vz = point.z - sz

 // Project onto wall direction (u in [0, 1] when clamped)
 const uRaw = (vx * wx + vz * wz) / Math.sqrt(lenSq)
 const u = uRaw

 // Project onto perp direction (signed distance)
 const perpSigned = vx * px + vz * pz

 // Closest point on segment (clamped to [0, 1])
 const uClamped = Math.max(0, Math.min(1, uRaw))
 const closestX = sx + dx * uClamped
 const closestZ = sz + dz * uClamped

 // Perpendicular distance from point to segment (always >= 0)
 const distance = Math.hypot(point.x - closestX, point.z - closestZ)

 return {
 u,
 perpSigned,
 distance,
 closest: [closestX, closestZ],
 }
}

/**
 * Door/Window mesh: 从 world Box3 推算 wall-local position + 尺寸
 *
 * 输入:
 *   - doorBox: 门 mesh 的 world Box3
 *   - wallStart / wallEnd: 墙的 start/end (level 平面 [x, z])
 *   - doorSillHeight: 默认 0 (门从地面起);window 用 windowSillHeight (e.g. 0.9)
 *
 * 输出:
 *   - position: 传给 DoorNode / WindowNode 的 [u, height/2, 0]
 *     (wall-local: u 沿墙,v 是高度,z 是从墙中面偏移)
 *   - width: 沿墙方向的尺寸 (X-Y bbox 的较长水平轴)
 *   - height: 垂直方向尺寸 (Y)
 *
 * 调用顺序:
 *   1) 用 wallGeometryFromBox 拿到 wall 的 start/end/direction
 *   2) 用 doorBox.getCenter() 算 door 中心点
 *   3) 用 projectOntoWall 算 u, perpSigned
 *   4) 用 wall direction 算 width (door bbox 在墙方向上的投影)
 */
export function doorOrWindowGeometryFromBox(
 openingBox: THREE.Box3,
 wallStart: [number, number],
 wallEnd: [number, number],
): {
 position: [number, number, number]
 width: number
 height: number
 u: number
 perpSigned: number
 distance: number
} {
 const center = new THREE.Vector3()
 openingBox.getCenter(center)

 const proj = projectOntoWall({ x: center.x, z: center.z }, wallStart, wallEnd)

 const dx = openingBox.max.x - openingBox.min.x
 const dy = openingBox.max.y - openingBox.min.y
 const dz = openingBox.max.z - openingBox.min.z

 // width = 沿墙方向的水平尺寸 (跟 wall direction 同向的那个水平轴)
 const wx = wallEnd[0] - wallStart[0]
 const wz = wallEnd[1] - wallStart[1]
 const wallLen = Math.hypot(wx, wz)
 const wallDxNorm = wallLen > 1e-9 ? wx / wallLen : 1
 const wallDzNorm = wallLen > 1e-9 ? wz / wallLen : 0

 // 把 (dx, dz) 投影到墙方向,取那个轴作为 width
 const widthAlongWall = Math.abs(dx * wallDxNorm + dz * wallDzNorm)
 const height = Math.max(dy, 1e-6)
 // width 取"沿墙"的尺寸;如果 < 0.05m (5cm),fallback 到 0.9m 默认
 const width = Math.max(widthAlongWall, 0.05)

 // position = [uMeters, height/2, 0] — wall-local coordinates
 // door.ts schema: position 是 wall-local [沿墙的米数, 离地高度, 墙厚度方向偏移]
 //   - door-math.ts:wallLocalToWorld 验证: worldX = start[0] + localX*cos(angle)
 //     即 localX 是从 wallStart 起的米数 (0 = start, wallLength = end)
 //   - wall-system.tsx:824-826 设 mesh.rotation.y = -angle, child mesh 继承该旋转
 const wallLength = Math.max(wallLen, 1e-6)
 const uMeters = proj.u * wallLength

 return {
 position: [uMeters, height / 2, 0],
 width,
 height,
 u: proj.u,
 perpSigned: proj.perpSigned,
 distance: proj.distance,
 }
}

/**
 * 检测 slab mesh 是不是 axis-aligned 矩形
 *
 * 用法: 在 caller 里判断 slabGeometryFromBox 是否适用,如果不是则 fallback
 * 到 ItemNode + metadata.simplifiedSlab = true。
 *
 * 实现思路: 把 mesh.geometry 的 boundingBox 跟 mesh 的 boundingBox 对比。
 * 对于 axis-aligned 矩形 slab,两者一致;对于旋转 / 异形 slab,不一致。
 *
 * 简化版: 我们只看 mesh.matrix 是不是单位矩阵 (无旋转/缩放)。
 */
export function isAxisAlignedBox(mesh: THREE.Mesh): boolean {
 const m = mesh.matrix
 // Axis-aligned iff upper-left 3x3 is identity (no rotation, no scale).
 // Translation (elements 12/13/14) is allowed.
 // Elements layout: [0..3]=col0, [4..7]=col1, [8..11]=col2, [12..15]=col3
 const eps = 1e-4
 return (
 // diagonal
 Math.abs(m.elements[0] - 1) < eps &&
 Math.abs(m.elements[5] - 1) < eps &&
 Math.abs(m.elements[10] - 1) < eps &&
 // off-diagonal (must be ~0)
 Math.abs(m.elements[1]) < eps &&
 Math.abs(m.elements[2]) < eps &&
 Math.abs(m.elements[4]) < eps &&
 Math.abs(m.elements[6]) < eps &&
 Math.abs(m.elements[8]) < eps &&
 Math.abs(m.elements[9]) < eps &&
 // homogeneous W
 Math.abs(m.elements[15] - 1) < eps
 )
}
