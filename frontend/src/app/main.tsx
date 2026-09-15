import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Welcome from '../pages/welcome/Welcome';
import Onboard from '../pages/onboarding/Onboard';
import AniSlot from '../pages/anislot/AniSlot';
import '../pages/welcome/welcome.css';
import '../pages/onboarding/onboard.css';
import '../pages/anislot/anislot.css';

const root = document.getElementById('welcome-root');
if (root) {
    // Render with real font metrics, but remain usable when a font fails.
    const mount = () => createRoot(root).render(
        <StrictMode><Welcome dashboardUrl={root.dataset.dashboardUrl || '/dashboard/'} /></StrictMode>,
    );
    Promise.race([
        Promise.all([document.fonts.load('700 80px "Montserrat Variable"'), document.fonts.load('italic 500 45px "Montserrat Variable"')]),
        new Promise(resolve => setTimeout(resolve, 2000)),
    ]).then(mount, mount);
}

const onboardRoot = document.getElementById('onboard-root');
if (onboardRoot) {
    createRoot(onboardRoot).render(
        <StrictMode>
            <Onboard
                anislotUrl={onboardRoot.dataset.anislotUrl || '/anislot/'}
                predictionMarketUrl={onboardRoot.dataset.predictionMarketUrl || '/prediction-market/'}
                backUrl={onboardRoot.dataset.backUrl || '/'}
            />
        </StrictMode>,
    );
}

const anislotRoot = document.getElementById('anislot-root');
if (anislotRoot) {
    createRoot(anislotRoot).render(
        <StrictMode>
            <AniSlot
                backUrl={anislotRoot.dataset.backUrl || '/'}
                coreUrl={anislotRoot.dataset.coreUrl || '/anislot/core/'}
            />
        </StrictMode>,
    );
}
