import { useRef, useState, useCallback, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei'
import './Viewer.css'

export default function Viewer({ onBack }) {
  const [objects, setObjects] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const inputRef = useRef()

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase()
      if (!['obj','stl','glb','gltf'].includes(ext)) return
      const id = crypto.randomUUID()
      setObjects(prev => [...prev, {
        id, name: file.name.replace(/\.[^.]+$/, ''), file, ext,
        visible: true,
        position: [0,0,0], rotation: [0,0,0], scale: [1,1,1]
      }])
      setSelectedId(id)
    })
  }, [])

  return (
    <div className="viewer-shell" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>

      {/* Top bar */}
      <header className="viewer-topbar">
        <button className="back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>WORKSPACE</span>
        </button>
        <div className="topbar-title">
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="#C8A97E" strokeWidth="1" fill="none"/>
            <circle cx="14" cy="14" r="2" fill="#C8A97E"/>
          </svg>
          <span>3D VIEWER</span>
        </div>
        <div className="topbar-actions">
          <button className="toolbar-btn" onClick={() => inputRef.current?.click()}>
            + Importar
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".obj,.stl,.glb,.gltf"
            multiple
            style={{ display: 'none' }}
            onChange={e => {
              Array.from(e.target.files).forEach(file => {
                const ext = file.name.split('.').pop().toLowerCase()
                const id = crypto.randomUUID()
                setObjects(prev => [...prev, {
                  id, name: file.name.replace(/\.[^.]+$/, ''), file, ext,
                  visible: true, position: [0,0,0], rotation: [0,0,0], scale: [1,1,1]
                }])
                setSelectedId(id)
              })
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <div className="viewer-body">
        {/* Scene panel */}
        <aside className="scene-panel">
          <div className="panel-section-title">ESCENA</div>
          {objects.length === 0 && (
            <div className="scene-empty">
              <span>Arrastra modelos aquí</span>
              <span className="scene-empty-sub">OBJ · STL · GLB · GLTF</span>
            </div>
          )}
          {objects.map(obj => (
            <div
              key={obj.id}
              className={`scene-item ${selectedId === obj.id ? 'active' : ''}`}
              onClick={() => setSelectedId(obj.id)}
            >
              <span className="scene-item-icon">◈</span>
              <span className="scene-item-name">{obj.name}</span>
              <button
                className="scene-item-vis"
                onClick={e => {
                  e.stopPropagation()
                  setObjects(prev => prev.map(o => o.id === obj.id ? { ...o, visible: !o.visible } : o))
                }}
              >{obj.visible ? '◉' : '○'}</button>
            </div>
          ))}
        </aside>

        {/* Viewport */}
        <main className="viewport">
          {objects.length === 0 && (
            <div className="viewport-empty">
              <div className="drop-zone-hint">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <polygon points="24,4 44,14 44,34 24,44 4,34 4,14" stroke="#C8A97E" strokeWidth="0.8" fill="none" opacity="0.4"/>
                  <polygon points="24,12 36,18 36,30 24,36 12,30 12,18" stroke="#C8A97E" strokeWidth="0.5" fill="none" opacity="0.25"/>
                  <circle cx="24" cy="24" r="3" fill="#C8A97E" opacity="0.5"/>
                </svg>
                <span>Arrastra un modelo 3D para comenzar</span>
              </div>
            </div>
          )}
          <Canvas camera={{ position: [3, 2, 5], fov: 45 }} shadows>
            <color attach="background" args={['#080808']} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
            <gridHelper args={[20, 20, '#1a1a1a', '#111']} />
            <OrbitControls makeDefault />
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
              <GizmoViewport axisColors={['#e05050','#50c050','#5080e0']} labelColor="white" />
            </GizmoHelper>
            <Environment preset="city" />
          </Canvas>
        </main>

        {/* Properties panel */}
        {selectedId && (() => {
          const obj = objects.find(o => o.id === selectedId)
          if (!obj) return null
          return (
            <aside className="props-panel">
              <div className="panel-section-title">PROPIEDADES</div>
              <div className="props-name">{obj.name}</div>
              <div className="props-badge">.{obj.ext.toUpperCase()}</div>

              {[
                { label: 'POSICIÓN', key: 'position', labels: ['X','Y','Z'] },
                { label: 'ROTACIÓN', key: 'rotation', labels: ['X','Y','Z'] },
                { label: 'ESCALA',   key: 'scale',    labels: ['X','Y','Z'] },
              ].map(({ label, key, labels }) => (
                <div key={key} className="transform-group">
                  <div className="transform-label">{label}</div>
                  <div className="transform-inputs">
                    {[0,1,2].map(i => (
                      <label key={i} className="xyz-input">
                        <span className={`xyz-axis axis-${labels[i].toLowerCase()}`}>{labels[i]}</span>
                        <input
                          type="number"
                          value={obj[key][i]}
                          step={key === 'rotation' ? 5 : key === 'scale' ? 0.1 : 0.1}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0
                            setObjects(prev => prev.map(o => {
                              if (o.id !== selectedId) return o
                              const arr = [...o[key]]
                              arr[i] = val
                              return { ...o, [key]: arr }
                            }))
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </aside>
          )
        })()}
      </div>
    </div>
  )
}
