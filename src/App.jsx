import { useState } from 'react'
import Landing from './components/landing/Landing'
import Viewer from './components/viewer/Viewer'

export default function App() {
  const [activeApp, setActiveApp] = useState(null)

  if (activeApp === '3dviewer') {
    return <Viewer onBack={() => setActiveApp(null)} />
  }

  return <Landing onLaunch={setActiveApp} />
}
