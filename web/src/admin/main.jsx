import { createRoot } from 'react-dom/client';
import '../lib/theme.js';
import '../style.css';
import AdminApp from './AdminApp.jsx';

createRoot(document.getElementById('root')).render(<AdminApp />);
