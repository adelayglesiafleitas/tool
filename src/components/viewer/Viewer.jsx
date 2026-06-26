import { useRef, useState, useCallback, useMemo, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { Vector3 } from 'three'
import { models as PRESET_MODELS } from 'virtual:models'
import { ModelObject } from './ModelObject'
import './Viewer.css'

const ENV_PRESETS = ['city','sunset','dawn','night','warehouse','forest','apartment','studio','lobby','park']

function computePositions(objects, boundsMap) {
  const sizes = objects.map(o => {
    const b = boundsMap[o.id]
    return { w: b ? b.getSize(new Vector3()).x : 2 }
  })
  const totalW = sizes.reduce((acc, s, i) => acc + s.w + (i < sizes.length - 1 ? s.w : 0), 0)
  let cursor = -totalW / 2
  return objects.map((_, i) => {
    const cx = cursor + sizes[i].w / 2
    cursor += sizes[i].w + (i < sizes.length - 1 ? sizes[i].w : 0)
    return [cx, 0, 0]
  })
}

function CameraFocus({ controlsRef, target, size }) {
  const { camera } = useThree()
  const dest = useRef(new Vector3())
  const animating = useRef(false)

  const targetKey = target ? target.join(',') : null

  // Cada vez que cambia el target, disparar la animación
  useEffect(() => {
    if (targetKey) animating.current = true
  }, [targetKey])

  useFrame(() => {
    if (!animating.current) return
    const ctrl = controlsRef.current
    if (!ctrl || !target) { animating.current = false; return }

    dest.current.set(target[0], target[1], target[2])
    ctrl.target.lerp(dest.current, 0.1)

    const dist = Math.max((size ?? 2) * 2.8, 1.5)
    const dir = camera.position.clone().sub(ctrl.target).normalize()
    camera.position.lerp(dest.current.clone().add(dir.multiplyScalar(dist)), 0.08)
    ctrl.update()

    // Detener cuando llega al destino — el usuario recupera control total
    if (ctrl.target.distanceTo(dest.current) < 0.008) {
      animating.current = false
    }
  })
  return null
}

// ── Collapsible section (estilo Marmoset) ──────────────
function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="ms-section">
      <button className="ms-section-header" onClick={() => setOpen(o => !o)}>
        <span className={`ms-arrow ${open ? 'open' : ''}`}>▶</span>
        <span className="ms-section-title">{title}</span>
      </button>
      {open && <div className="ms-section-body">{children}</div>}
    </div>
  )
}

// ── Property row: label + control ──────────────────────
function PropRow({ label, children }) {
  return (
    <div className="ms-row">
      <span className="ms-label">{label}</span>
      <div className="ms-control">{children}</div>
    </div>
  )
}

// ── Slider + número (estilo Marmoset) ──────────────────
function SliderNum({ value, min = 0, max = 1, step = 0.01, onChange }) {
  return (
    <div className="ms-slidnum">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className="ms-slider" />
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)} className="ms-num" />
    </div>
  )
}

// ── Texture slot (cuadradito estilo Marmoset) ──────────
function TexSlot({ url, onChange, onClear }) {
  const ref = useRef()
  return (
    <div className="ms-texslot-wrap">
      <button className="ms-texslot" onClick={() => ref.current?.click()}
        style={{ backgroundImage: url ? `url(${url})` : 'none' }}>
        {!url && <span className="ms-texslot-icon">+</span>}
      </button>
      {url && <button className="ms-texclear" onClick={onClear} title="Quitar">✕</button>}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files[0]
          if (f) { onChange(URL.createObjectURL(f)); e.target.value = '' }
        }}
      />
    </div>
  )
}

// ── XYZ inputs ─────────────────────────────────────────
function XYZRow({ values, step = 0.1, onChange }) {
  return (
    <div className="ms-xyz">
      {['X','Y','Z'].map((ax, i) => (
        <label key={ax} className="ms-xyz-field">
          <span className={`ms-xyz-ax ax-${ax.toLowerCase()}`}>{ax}</span>
          <input type="number" step={step} value={values[i]}
            onChange={e => { const a=[...values]; a[i]=parseFloat(e.target.value)||0; onChange(a) }}
          />
        </label>
      ))}
    </div>
  )
}

// ── Toggle ─────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button className={`ms-toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)}>
      <span className="ms-toggle-knob" />
    </button>
  )
}

// ── Color swatch ───────────────────────────────────────
function ColorSwatch({ value, onChange }) {
  return (
    <label className="ms-color">
      <span className="ms-color-preview" style={{ background: value }} />
      <input type="color" value={value} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

// ──────────────────────────────────────────────────────
const DEF_MAT = { albedo: '#ffffff', albedoTex: null, roughness: 0.6, roughnessTex: null, metalness: 0.5, metalnessTex: null, normalTex: null, normalInt: 1, emissive: '#000000', emissiveTex: null, emissiveInt: 1, aoTex: null, aoInt: 1, wireframe: false }
const DEF_LIGHTS = { ambientInt: 0.5, envPreset: 'night', envInt: 0.3, envRot: 0, dirColor: '#ffffff', dirInt: 1.5, dirX: 5, dirY: 8, dirZ: 5, dirShadow: true }

export default function Viewer({ onBack }) {
  const [objects, setObjects] = useState(() =>
    PRESET_MODELS.map(m => ({ ...m, id: m.name, visible: true, position:[0,0,0], rotation:[0,0,0], scale:[1,1,1], mat:{ ...DEF_MAT } }))
  )
  const [boundsMap, setBoundsMap] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [lights, setLights] = useState(DEF_LIGHTS)
  const [inspecting, setInspecting] = useState('object')
  const [rotatingIds, setRotatingIds] = useState(new Set())
  const [autoRotate, setAutoRotate] = useState(true)
  const inputRef = useRef()
  const controlsRef = useRef()

  const handleLayout = useCallback((id, box) => {
    setBoundsMap(prev => prev[id] ? prev : { ...prev, [id]: box })
  }, [])

  const positions = useMemo(() => {
    if (!objects.every(o => boundsMap[o.id])) return null
    return computePositions(objects, boundsMap)
  }, [objects, boundsMap])

  const { focusTarget, focusSize } = useMemo(() => {
    if (!selectedId || !positions) return {}
    const idx = objects.findIndex(o => o.id === selectedId)
    if (idx === -1) return {}
    const box = boundsMap[selectedId]
    return { focusTarget: positions[idx], focusSize: box ? box.getSize(new Vector3()).length() : 2 }
  }, [selectedId, positions, objects, boundsMap])

  const updateObj = useCallback((id, patch) =>
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o)), [])
  const updateMat = useCallback((id, patch) =>
    setObjects(prev => prev.map(o => o.id === id ? { ...o, mat: { ...o.mat, ...patch } } : o)), [])
  const updateLight = patch => setLights(prev => ({ ...prev, ...patch }))

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    Array.from(e.dataTransfer.files).forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase()
      if (!['obj','stl','glb','gltf'].includes(ext)) return
      const name = file.name.replace(/\.[^.]+$/, '')
      setObjects(prev => [...prev, { id: crypto.randomUUID(), name, file, ext, texture: null, visible: true, position:[0,0,0], rotation:[0,0,0], scale:[1,1,1], mat:{ ...DEF_MAT } }])
    })
  }, [])

  const selected = objects.find(o => o.id === selectedId)
  const mat = selected?.mat ?? DEF_MAT
  const [showScene, setShowScene] = useState(false)
  const [showInspector, setShowInspector] = useState(false)

  return (
    <div className="viewer-shell" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>

      {/* Overlay backdrop para móvil */}
      {(showScene || showInspector) && (
        <div className="panel-backdrop" onClick={() => { setShowScene(false); setShowInspector(false) }} />
      )}

      {/* ── Topbar ── */}
      <header className="viewer-topbar">
        <button className="back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="back-label">WORKSPACE</span>
        </button>
        <div className="topbar-title">
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="#C8A97E" strokeWidth="1" fill="none"/>
            <circle cx="14" cy="14" r="2" fill="#C8A97E"/>
          </svg>
          <span>3D VIEWER</span>
        </div>
        <div className="topbar-actions">
          {/* Botones toggle para móvil */}
          <button className="toolbar-btn panel-toggle" onClick={() => { setShowScene(s => !s); setShowInspector(false) }} title="Escena">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.5" fill="currentColor" rx="0.5"/><rect x="1" y="6" width="8" height="1.5" fill="currentColor" rx="0.5"/><rect x="1" y="10" width="10" height="1.5" fill="currentColor" rx="0.5"/></svg>
          </button>
          <button className="toolbar-btn panel-toggle" onClick={() => { setShowInspector(s => !s); setShowScene(false) }} title="Inspector">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="0.8"/><line x1="5" y1="5" x2="5" y2="13" stroke="currentColor" strokeWidth="0.8"/></svg>
          </button>
          <button className="toolbar-btn" onClick={() => inputRef.current?.click()}>+ Importar</button>
          <input ref={inputRef} type="file" accept=".obj,.stl,.glb,.gltf" multiple style={{display:'none'}}
            onChange={e => {
              Array.from(e.target.files).forEach(file => {
                const name = file.name.replace(/\.[^.]+$/, '')
                setObjects(prev => [...prev, { id: crypto.randomUUID(), name, file, ext: file.name.split('.').pop().toLowerCase(), texture: null, visible: true, position:[0,0,0], rotation:[0,0,0], scale:[1,1,1], mat:{...DEF_MAT} }])
              })
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <div className="viewer-body">

        {/* ── Scene panel (izquierda) ── */}
        <aside className={`scene-panel ${showScene ? 'panel-open' : ''}`}>
          <div className="ms-scene-header">ESCENA</div>

          <div className="ms-scene-group">
            <div className="ms-scene-group-label">OBJETOS</div>
            {objects.length === 0 && <div className="scene-empty"><span>Arrastra modelos</span><span className="scene-empty-sub">OBJ · STL · GLB · GLTF</span></div>}
            {objects.map(obj => (
              <div key={obj.id}
                className={`scene-item ${selectedId === obj.id ? 'active' : ''}`}
                onClick={() => { setSelectedId(obj.id); setInspecting('object') }}>
                <span className="scene-item-icon">◈</span>
                <span className="scene-item-name">{obj.name}</span>
                <button className="scene-item-vis" onClick={e => { e.stopPropagation(); updateObj(obj.id, { visible: !obj.visible }) }}>
                  {obj.visible ? '◉' : '○'}
                </button>
              </div>
            ))}
          </div>

          <div className="ms-scene-group">
            <div className="ms-scene-group-label">ILUMINACIÓN</div>
            <div className={`scene-item ${inspecting === 'light' && !selectedId ? 'active' : ''}`}
              onClick={() => { setSelectedId(null); setInspecting('light') }}>
              <span className="scene-item-icon" style={{color:'#e8c87a'}}>☀</span>
              <span className="scene-item-name">Luces & Entorno</span>
            </div>
          </div>
        </aside>

        {/* ── Viewport ── */}
        <main className="viewport">
          <Canvas camera={{ position: [0, 2, 8], fov: 45 }} shadows>
            <color attach="background" args={['#0a0a0a']} />
            <ambientLight intensity={lights.ambientInt} />
            <directionalLight
              position={[lights.dirX, lights.dirY, lights.dirZ]}
              intensity={lights.dirInt} color={lights.dirColor}
              castShadow={lights.dirShadow}
            />
            <OrbitControls ref={controlsRef} makeDefault />
            <CameraFocus controlsRef={controlsRef} target={focusTarget} size={focusSize} />
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
              <GizmoViewport axisColors={['#e05050','#50c050','#5080e0']} labelColor="#aaa" />
            </GizmoHelper>
            <Environment preset={lights.envPreset} intensity={lights.envInt} />
            <Suspense fallback={null}>
              {objects.filter(o => o.visible).map((obj, i) => (
                <ModelObject key={obj.id} id={obj.id} name={obj.name} objUrl={obj.objUrl}
                  texture={obj.mat.albedoTex ?? obj.texture}
                  roughness={obj.mat.roughness} metalness={obj.mat.metalness}
                  color={obj.mat.albedo} wireframe={obj.mat.wireframe}
                  position={positions ? positions[i] : [0,0,0]}
                  selected={selectedId === obj.id}
                  rotating={rotatingIds.has(obj.id)}
                  onClick={() => {
                    setSelectedId(obj.id)
                    setInspecting('object')
                    setRotatingIds(prev => new Set([...prev, obj.id]))
                  }}
                  onToggleRotate={() => setRotatingIds(prev => {
                    const next = new Set(prev)
                    next.has(obj.id) ? next.delete(obj.id) : next.add(obj.id)
                    return next
                  })}
                  onLayout={handleLayout}
                />
              ))}
            </Suspense>
          </Canvas>
        </main>

        {/* ── Inspector (derecha, estilo Marmoset) ── */}
        <aside className={`ms-inspector ${showInspector ? 'panel-open' : ''}`}>

          {/* Objeto seleccionado */}
          {inspecting === 'object' && selected && (
            <>
              <div className="ms-inspector-name">
                <span className="ms-obj-icon">◈</span>
                <span>{selected.name}</span>
                <span className="ms-obj-ext">.{(selected.ext || 'OBJ').toUpperCase()}</span>
              </div>

              <Section title="TRANSFORM">
                <PropRow label="Position">
                  <XYZRow values={selected.position} step={0.1}
                    onChange={v => updateObj(selected.id, { position: v })} />
                </PropRow>
                <PropRow label="Rotation">
                  <XYZRow values={selected.rotation} step={1}
                    onChange={v => updateObj(selected.id, { rotation: v })} />
                </PropRow>
                <PropRow label="Scale">
                  <XYZRow values={selected.scale} step={0.01}
                    onChange={v => updateObj(selected.id, { scale: v })} />
                </PropRow>
              </Section>

              <Section title="SURFACE">
                {/* Albedo */}
                <div className="ms-channel">
                  <span className="ms-chan-label">Albedo</span>
                  <div className="ms-chan-controls">
                    <ColorSwatch value={mat.albedo} onChange={v => updateMat(selected.id, { albedo: v })} />
                    <TexSlot url={mat.albedoTex}
                      onChange={u => updateMat(selected.id, { albedoTex: u })}
                      onClear={() => updateMat(selected.id, { albedoTex: null })} />
                  </div>
                </div>

                {/* Roughness */}
                <div className="ms-channel">
                  <span className="ms-chan-label">Roughness</span>
                  <div className="ms-chan-controls">
                    <TexSlot url={mat.roughnessTex}
                      onChange={u => updateMat(selected.id, { roughnessTex: u })}
                      onClear={() => updateMat(selected.id, { roughnessTex: null })} />
                    <SliderNum value={mat.roughness} onChange={v => updateMat(selected.id, { roughness: v })} />
                  </div>
                </div>

                {/* Metalness */}
                <div className="ms-channel">
                  <span className="ms-chan-label">Metalness</span>
                  <div className="ms-chan-controls">
                    <TexSlot url={mat.metalnessTex}
                      onChange={u => updateMat(selected.id, { metalnessTex: u })}
                      onClear={() => updateMat(selected.id, { metalnessTex: null })} />
                    <SliderNum value={mat.metalness} onChange={v => updateMat(selected.id, { metalness: v })} />
                  </div>
                </div>

                {/* Normals */}
                <div className="ms-channel">
                  <span className="ms-chan-label">Normals</span>
                  <div className="ms-chan-controls">
                    <TexSlot url={mat.normalTex}
                      onChange={u => updateMat(selected.id, { normalTex: u })}
                      onClear={() => updateMat(selected.id, { normalTex: null })} />
                    <SliderNum value={mat.normalInt} onChange={v => updateMat(selected.id, { normalInt: v })} />
                  </div>
                </div>

                {/* Emissive */}
                <div className="ms-channel">
                  <span className="ms-chan-label">Emissive</span>
                  <div className="ms-chan-controls">
                    <ColorSwatch value={mat.emissive} onChange={v => updateMat(selected.id, { emissive: v })} />
                    <TexSlot url={mat.emissiveTex}
                      onChange={u => updateMat(selected.id, { emissiveTex: u })}
                      onClear={() => updateMat(selected.id, { emissiveTex: null })} />
                    <SliderNum value={mat.emissiveInt} onChange={v => updateMat(selected.id, { emissiveInt: v })} />
                  </div>
                </div>

                {/* AO */}
                <div className="ms-channel">
                  <span className="ms-chan-label">AO</span>
                  <div className="ms-chan-controls">
                    <TexSlot url={mat.aoTex}
                      onChange={u => updateMat(selected.id, { aoTex: u })}
                      onClear={() => updateMat(selected.id, { aoTex: null })} />
                    <SliderNum value={mat.aoInt} onChange={v => updateMat(selected.id, { aoInt: v })} />
                  </div>
                </div>

                {/* Wireframe */}
                <PropRow label="Wireframe">
                  <Toggle value={mat.wireframe} onChange={v => updateMat(selected.id, { wireframe: v })} />
                </PropRow>
              </Section>
            </>
          )}

          {/* Sin selección → placeholder */}
          {inspecting === 'object' && !selected && (
            <div className="ms-empty">
              <span>Selecciona un objeto</span>
            </div>
          )}

          {/* Panel de Luces */}
          {inspecting === 'light' && (
            <>
              <div className="ms-inspector-name">
                <span className="ms-obj-icon" style={{color:'#e8c87a'}}>☀</span>
                <span>Luces & Entorno</span>
              </div>

              <Section title="SKY / IBL">
                <PropRow label="Preset">
                  <select className="ms-select" value={lights.envPreset}
                    onChange={e => updateLight({ envPreset: e.target.value })}>
                    {ENV_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </PropRow>
                <PropRow label="Intensity">
                  <SliderNum value={lights.envInt} min={0} max={4} step={0.05}
                    onChange={v => updateLight({ envInt: v })} />
                </PropRow>
                <PropRow label="Rotation">
                  <SliderNum value={lights.envRot} min={0} max={360} step={1}
                    onChange={v => updateLight({ envRot: v })} />
                </PropRow>
              </Section>

              <Section title="AMBIENT">
                <PropRow label="Intensity">
                  <SliderNum value={lights.ambientInt} min={0} max={4} step={0.05}
                    onChange={v => updateLight({ ambientInt: v })} />
                </PropRow>
              </Section>

              <Section title="DIRECTIONAL">
                <PropRow label="Color">
                  <ColorSwatch value={lights.dirColor} onChange={v => updateLight({ dirColor: v })} />
                </PropRow>
                <PropRow label="Intensity">
                  <SliderNum value={lights.dirInt} min={0} max={8} step={0.05}
                    onChange={v => updateLight({ dirInt: v })} />
                </PropRow>
                <PropRow label="Position">
                  <XYZRow values={[lights.dirX, lights.dirY, lights.dirZ]} step={0.5}
                    onChange={([x,y,z]) => updateLight({ dirX: x, dirY: y, dirZ: z })} />
                </PropRow>
                <PropRow label="Shadows">
                  <Toggle value={lights.dirShadow} onChange={v => updateLight({ dirShadow: v })} />
                </PropRow>
              </Section>
            </>
          )}

        </aside>
      </div>
    </div>
  )
}
