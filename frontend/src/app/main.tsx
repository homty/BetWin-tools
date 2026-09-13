import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Welcome from './Welcome';
import './welcome.css';

const root = document.getElementById('welcome-root');
if (root) {
    // Render with real font metrics, but remain usable when a font fails.
    const mount = () => createRoot(root).render(
        <StrictMode><Welcome dashboardUrl={root.dataset.dashboardUrl || '/dashboard/'} /></StrictMode>,
    );
    Promise.race([
        Promise.all([document.fonts.load('700 80px Montserrat'), document.fonts.load('italic 500 45px Montserrat')]),
        new Promise(resolve => setTimeout(resolve, 2000)),
    ]).then(mount, mount);
}

