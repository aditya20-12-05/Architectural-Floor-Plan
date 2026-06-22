import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// StrictMode intentionally omitted: it double-invokes effects in dev, which
// fights with the imperative three.js camera / PNG-export registration.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
