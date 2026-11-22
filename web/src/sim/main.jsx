import { createRoot } from 'react-dom/client';
import '../style.css';
import './sim.css';
import SimApp from './SimApp.jsx';

createRoot(document.getElementById('root')).render(<SimApp />);
