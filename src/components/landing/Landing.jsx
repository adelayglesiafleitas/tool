import { useRef } from 'react'
import { useScrollFrames } from '../../hooks/useScrollFrames'
import './Landing.css'

const TOOLS = [
  {
    id: '3dviewer',
    index: '01',
    label: 'TOOL',
    title: '3D Viewer',
    subtitle: 'Model Review System',
    description: 'Carga, inspecciona y presenta modelos 3D con materiales PBR. Gestiona escenas multi-objeto, controla transformaciones y exporta capturas para presentaciones a cliente.',
    tags: ['OBJ', 'STL', 'GLB', 'GLTF', 'PBR'],
    cta: 'Abrir herramienta',
  },
]

export default function Landing({ onLaunch }) {
  const canvasRef = useRef(null)
  const { ready, done } = useScrollFrames(canvasRef)
  const tool = TOOLS[0]

  return (
    <div className="landing">

      {/* Canvas — animación autoplay */}
      <canvas ref={canvasRef} className="anim-canvas" />

      {/* Velo de carga */}
      {!ready && (
        <div className="loading-veil">
          <div className="loading-bar-wrap">
            <div className="loading-bar" />
          </div>
          <span className="loading-label">CARGANDO</span>
        </div>
      )}

      {/* Portal — aparece al terminar la animación */}
      {done && (
        <div className="portal-overlay">
          <div className="portal-grad" />

          <header className="landing-header portal-animate-down">
            <div className="logo-mark">
              <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="#C8A97E" strokeWidth="1" fill="none"/>
                <polygon points="14,7 21,11 21,17 14,21 7,17 7,11" stroke="#C8A97E" strokeWidth="0.5" fill="none" opacity="0.5"/>
                <circle cx="14" cy="14" r="2" fill="#C8A97E"/>
              </svg>
            </div>
            <div className="logo-text">
              <span className="logo-name">LALIVINGSTON</span>
              <span className="logo-sub">STUDIO</span>
            </div>
            <nav className="landing-nav">
              <span className="nav-label">WORKSPACE</span>
            </nav>
          </header>

          <main className="slide-content portal-animate-up">
            <div className="slide-meta">
              <span className="slide-index">{tool.index}</span>
              <span className="slide-divider" />
              <span className="slide-label">{tool.label}</span>
            </div>
            <div className="slide-body">
              <h1 className="slide-title">{tool.title}</h1>
              <h2 className="slide-subtitle">{tool.subtitle}</h2>
              <p className="slide-desc">{tool.description}</p>
              <div className="slide-tags">
                {tool.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
              <button className="slide-cta portal-animate-up-delay" onClick={() => onLaunch(tool.id)}>
                <span>{tool.cta}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </main>

          <footer className="landing-footer portal-animate-down">
            <span className="footer-copy">© 2025 LALIVINGSTON</span>
            <span className="footer-right">WORKSPACE</span>
          </footer>
        </div>
      )}

    </div>
  )
}
