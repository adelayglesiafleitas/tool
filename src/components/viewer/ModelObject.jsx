import { useLoader, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { TextureLoader, MeshStandardMaterial, Box3, Vector3 } from 'three'
import { useMemo, useRef, useLayoutEffect } from 'react'

export function ModelObject({ id, name, objUrl, texture: textureUrl, roughness = 0.6, metalness = 0.1, color = '#ffffff', wireframe = false, position = [0, 0, 0], selected, onClick, onLayout }) {
  const meshRef = useRef()
  const obj = useLoader(OBJLoader, objUrl ?? `/models/${encodeURIComponent(name)}.obj`)
  const texture = useLoader(TextureLoader, textureUrl ?? '/models/__fallback.png')

  const scene = useMemo(() => {
    const clone = obj.clone(true)
    clone.traverse(child => {
      if (!child.isMesh) return
      child.geometry.computeVertexNormals()
      child.material = new MeshStandardMaterial({
        map: textureUrl ? texture : null,
        color,
        roughness,
        metalness,
        wireframe,
      })
      child.castShadow = true
      child.receiveShadow = true
    })
    const box = new Box3().setFromObject(clone)
    const center = box.getCenter(new Vector3())
    clone.position.sub(center)
    return clone
  }, [obj, texture, textureUrl, roughness, metalness, color, wireframe])

  // Pivote: girar sobre Y cuando está seleccionado
  const pivotRef = useRef()
  useFrame((_, delta) => {
    if (selected && pivotRef.current) {
      pivotRef.current.rotation.y += delta * 0.8
    }
  })

  // Reportar el bounding box real al Viewer para que calcule el layout
  useLayoutEffect(() => {
    if (!meshRef.current) return
    const box = new Box3().setFromObject(meshRef.current)
    onLayout?.(id, box)
  }, [scene, id, onLayout])

  // Posición del label: base del bounding box, centrado
  const labelY = useMemo(() => {
    if (!meshRef.current) return -1
    const box = new Box3().setFromObject(meshRef.current)
    return box.min.y - 0.2
  }, [scene])

  return (
    <group position={position} onClick={onClick}>
      {/* Pivote: todo gira sobre este grupo cuando está seleccionado */}
      <group ref={pivotRef}>
        {/* Mesh separado en su propio ref para medir sin Html */}
        <group ref={meshRef}>
          <primitive object={scene} />
        </group>

      </group>

      <Html position={[0, labelY, 0]} center distanceFactor={6}>
        <div className={`model-label ${selected ? 'model-label--active' : ''}`}>
          {name}
        </div>
      </Html>
    </group>
  )
}
