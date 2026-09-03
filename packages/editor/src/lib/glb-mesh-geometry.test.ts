import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import {
 doorOrWindowGeometryFromBox,
 isAxisAlignedBox,
 projectOntoWall,
 slabGeometryFromBox,
 wallGeometryFromBox,
} from './glb-mesh-geometry'

describe('wallGeometryFromBox', () => {
 test('X-direction wall: length 3m, thickness 0.2m (Z), height 2.5m (Y)', () => {
 // ifcopenshell Y-up convention: Y is height, Z is thickness for X-axis wall
 const box = new THREE.Box3(
 new THREE.Vector3(0, 0, 0),
 new THREE.Vector3(3, 2.5, 0.2),
 )
 const result = wallGeometryFromBox(box)
 expect(result.start).toEqual([0, 0])
 expect(result.end).toEqual([3, 0])
 expect(result.thickness).toBeCloseTo(0.2, 6)
 expect(result.height).toBeCloseTo(2.5, 6)
 expect(result.direction).toEqual([1, 0])
 })

 test('Z-direction wall: length 4m, thickness 0.15m (X), height 2.5m (Y)', () => {
 const box = new THREE.Box3(
 new THREE.Vector3(0, 0, 0),
 new THREE.Vector3(0.15, 2.5, 4),
 )
 const result = wallGeometryFromBox(box)
 expect(result.start).toEqual([0, 0])
 expect(result.end).toEqual([0, 4])
 expect(result.thickness).toBeCloseTo(0.15, 6)
 expect(result.height).toBeCloseTo(2.5, 6)
 expect(result.direction).toEqual([0, 1])
 })

 test('wall with positive offset (not at origin)', () => {
 // X-axis wall at (5, 0..2.5, 7..7.2) — start=(5,7), end=(8,7), thickness=0.2
 const box = new THREE.Box3(
 new THREE.Vector3(5, 0, 7),
 new THREE.Vector3(8, 2.5, 7.2),
 )
 const result = wallGeometryFromBox(box)
 expect(result.start).toEqual([5, 7])
 expect(result.end).toEqual([8, 7])
 expect(result.thickness).toBeCloseTo(0.2, 6)
 expect(result.height).toBeCloseTo(2.5, 6)
 })

 test('degenerate wall (height = 0) returns epsilon height', () => {
 const box = new THREE.Box3(
 new THREE.Vector3(0, 0, 0),
 new THREE.Vector3(3, 0, 0.2),
 )
 const result = wallGeometryFromBox(box)
 expect(result.height).toBeGreaterThan(0)
 })
})

describe('slabGeometryFromBox', () => {
 test('basic rectangular slab (10x8, 0.1 thick)', () => {
 const box = new THREE.Box3(
 new THREE.Vector3(0, -0.1, 0),
 new THREE.Vector3(10, 0, 8),
 )
 const result = slabGeometryFromBox(box)
 expect(result.polygon).toEqual([
 [0, 0],
 [10, 0],
 [10, 8],
 [0, 8],
 ])
 // elevation = top of slab = box.max.y
 expect(result.elevation).toBeCloseTo(0, 6)
 // thickness = 0.1
 expect(result.thickness).toBeCloseTo(0.1, 6)
 })

 test('thick slab at positive elevation', () => {
 const box = new THREE.Box3(
 new THREE.Vector3(0, 0, 0),
 new THREE.Vector3(5, 0.2, 6),
 )
 const result = slabGeometryFromBox(box)
 expect(result.elevation).toBeCloseTo(0.2, 6)
 expect(result.thickness).toBeCloseTo(0.2, 6)
 })

 test('zero-thickness slab returns epsilon thickness', () => {
 const box = new THREE.Box3(
 new THREE.Vector3(0, 0, 0),
 new THREE.Vector3(5, 0, 6),
 )
 const result = slabGeometryFromBox(box)
 expect(result.thickness).toBeGreaterThan(0)
 })
})

describe('projectOntoWall', () => {
 test('point at wall midpoint → u=0.5, distance=0', () => {
 const result = projectOntoWall(
 { x: 1.5, z: 0 },
 [0, 0],
 [3, 0],
 )
 expect(result.u).toBeCloseTo(0.5, 6)
 expect(result.distance).toBeCloseTo(0, 6)
 expect(result.perpSigned).toBeCloseTo(0, 6)
 })

 test('point perpendicular to wall (+Z) by 2m → u=0.5, distance=2', () => {
 // Wall is along +X. Perp convention: rotated 90° CCW from wall direction.
 // Rotating (1, 0) CCW 90° in XZ plane (Y up, looking down) = (0, 1) = +Z.
 // So a point at +Z relative to the wall should give positive perpSigned.
 const result = projectOntoWall(
 { x: 1.5, z: 2 },
 [0, 0],
 [3, 0],
 )
 expect(result.u).toBeCloseTo(0.5, 6)
 expect(result.distance).toBeCloseTo(2, 6)
 expect(result.perpSigned).toBeCloseTo(2, 6)
 })

 test('point before wall start (u<0)', () => {
 const result = projectOntoWall(
 { x: -1, z: 0 },
 [0, 0],
 [3, 0],
 )
 expect(result.u).toBeLessThan(0)
 expect(result.distance).toBeCloseTo(1, 6)
 expect(result.closest).toEqual([0, 0])
 })

 test('point after wall end (u>1)', () => {
 const result = projectOntoWall(
 { x: 4, z: 0 },
 [0, 0],
 [3, 0],
 )
 expect(result.u).toBeGreaterThan(1)
 expect(result.distance).toBeCloseTo(1, 6)
 expect(result.closest).toEqual([3, 0])
 })

 test('Z-direction wall midpoint', () => {
 // wall from (0,0) to (0,4) — direction is +Z
 const result = projectOntoWall(
 { x: 0, z: 2 },
 [0, 0],
 [0, 4],
 )
 expect(result.u).toBeCloseTo(0.5, 6)
 expect(result.distance).toBeCloseTo(0, 6)
 })

 test('Z-direction wall point offset in -X direction', () => {
 // Wall along +Z. Convention: perp = rotated 90° CCW in XZ plane looking down from +Y.
 // For wall dir (0,1), perp = (-1, 0) = -X. Point at -X gives positive perpSigned.
 const result = projectOntoWall(
 { x: -2, z: 2 },
 [0, 0],
 [0, 4],
 )
 expect(result.u).toBeCloseTo(0.5, 6)
 expect(result.distance).toBeCloseTo(2, 6)
 expect(result.perpSigned).toBeCloseTo(2, 6)
 })

 test('degenerate wall (start == end)', () => {
 const result = projectOntoWall(
 { x: 3, z: 4 },
 [0, 0],
 [0, 0],
 )
 expect(result.u).toBe(0)
 expect(result.distance).toBeCloseTo(5, 6)
 })
})

describe('doorOrWindowGeometryFromBox', () => {
 test('door at wall center (x=1.5), on wall plane', () => {
 // door bbox centered at (1.5, 1.05, 0), 0.6 wide x 2.1 tall x 0.1 thick
 const openingBox = new THREE.Box3(
 new THREE.Vector3(1.2, 0, -0.05),
 new THREE.Vector3(1.8, 2.1, 0.05),
 )
 const result = doorOrWindowGeometryFromBox(openingBox, [0, 0], [3, 0])
 expect(result.u).toBeCloseTo(0.5, 3)
 expect(result.distance).toBeCloseTo(0, 6)
 expect(result.height).toBeCloseTo(2.1, 6)
 expect(result.width).toBeCloseTo(0.6, 6)
 // position[0] = uMeters = u * wallLength = 0.5 * 3 = 1.5
 expect(result.position[0]).toBeCloseTo(1.5, 6)
 // position[1] = height/2 = 1.05
 expect(result.position[1]).toBeCloseTo(1.05, 6)
 expect(result.position[2]).toBe(0)
 })

 test('door 0.5m off wall (still attached)', () => {
 // door centered at (1.5, 1.05, 0.5) — offset 0.5m in +Z from wall plane, u = 0.5
 const openingBox = new THREE.Box3(
 new THREE.Vector3(1.2, 0, 0.25),
 new THREE.Vector3(1.8, 2.1, 0.75),
 )
 const result = doorOrWindowGeometryFromBox(openingBox, [0, 0], [3, 0])
 expect(result.distance).toBeCloseTo(0.5, 6)
 expect(result.u).toBeCloseTo(0.5, 3)
 })

 test('door near start of wall', () => {
 // door centered at (0.5, 1.05, 0) — u = 0.5/3 ≈ 0.167
 const openingBox = new THREE.Box3(
 new THREE.Vector3(0.3, 0, -0.05),
 new THREE.Vector3(0.7, 2.1, 0.05),
 )
 const result = doorOrWindowGeometryFromBox(openingBox, [0, 0], [3, 0])
 expect(result.u).toBeCloseTo(0.5 / 3, 3)
 expect(result.position[0]).toBeCloseTo(0.5, 6)
 })

 test('very thin door bbox falls back to minimum width', () => {
 // wall-aligned bbox with very small width along wall direction
 const openingBox = new THREE.Box3(
 new THREE.Vector3(1.4, 0, -0.05),
 new THREE.Vector3(1.41, 2.1, 0.05),
 )
 const result = doorOrWindowGeometryFromBox(openingBox, [0, 0], [3, 0])
 expect(result.width).toBeGreaterThanOrEqual(0.05)
 })
})

describe('isAxisAlignedBox', () => {
 test('identity matrix → true', () => {
 const mesh = new THREE.Mesh()
 mesh.matrix.identity()
 mesh.matrixAutoUpdate = false
 mesh.matrixWorldNeedsUpdate = false
 expect(isAxisAlignedBox(mesh)).toBe(true)
 })

 test('default mesh has identity matrix → true', () => {
 const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
 mesh.updateMatrix()
 expect(isAxisAlignedBox(mesh)).toBe(true)
 })

 test('rotated 45° around Y → false', () => {
 const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
 mesh.rotation.y = Math.PI / 4
 mesh.updateMatrix()
 expect(isAxisAlignedBox(mesh)).toBe(false)
 })

 test('scaled 2x → false', () => {
 const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
 mesh.scale.set(2, 2, 2)
 mesh.updateMatrix()
 expect(isAxisAlignedBox(mesh)).toBe(false)
 })

 test('translated only (no rotation/scale) → true', () => {
 // Translation is allowed for axis-aligned boxes — rotation/scale would change axis alignment.
 const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
 mesh.position.set(5, 0, 7)
 mesh.updateMatrix()
 expect(isAxisAlignedBox(mesh)).toBe(true)
 })
})
