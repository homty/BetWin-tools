import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { isLoading, subscribe } from '../../services/loading';
import { prepareApplication } from '../../services/startup';
import DownloadingText from '../../components/downloading-text/DownloadingText';
import BetWinWord from '../../components/brand/BetWinWord';

gsap.registerPlugin(useGSAP);

export default function Welcome({ dashboardUrl }: { dashboardUrl: string }) {
    const container = useRef<HTMLElement>(null);
    const [ready, setReady] = useState(false);
    const [downloadingStarted, setDownloadingStarted] = useState(false);
    const [downloadingActive, setDownloadingActive] = useState(isLoading());
    const startupStarted = useRef(false);
    const transitionStarted = useRef(false);

    useGSAP(() => {
        const media = gsap.matchMedia();
        media.add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, context => {
            const root = container.current!;
            const chars = Array.from(root.querySelectorAll<HTMLElement>('.betwin-word__letter'));

            let disposed = false;
            const reduce = Boolean(context.conditions?.reduce);

            const startDownloading = () => {
                if (disposed || startupStarted.current) return;
                startupStarted.current = true;
                setDownloadingStarted(true);

                void prepareApplication(dashboardUrl).catch(error => {
                    // A preload failure must not lock the user out: normal navigation can retry it.
                    console.error('BetWin startup preparation failed.', error);
                });
            };

            if (reduce) {
                root.dataset.phase = 'waiting';
                startDownloading();
            } else {
                setReady(false);
                root.dataset.phase = 'intro';
                const intro = gsap.timeline({
                    onComplete: startDownloading,
                });
                intro.from(chars, { x: 42, opacity: 0, duration: 0.65, stagger: 0.1, ease: 'power2.out' });
            }

            const unsubscribe = subscribe(() => {
                setDownloadingActive(isLoading());
            });
            return () => {
                disposed = true;
                unsubscribe();
            };
        });
        return () => media.revert();
    }, { dependencies: [dashboardUrl], scope: container });

    const handleDownloadingSettled = () => {
        const loading = isLoading();
        setDownloadingActive(loading);
        if (loading || transitionStarted.current) {
            if (container.current) container.current.dataset.phase = 'waiting';
            return;
        }

        const root = container.current;
        const word = root?.querySelector<HTMLElement>('.word');
        const toolsBox = root?.querySelector<HTMLElement>('.tools-box');
        if (!root || !word || !toolsBox) return;

        transitionStarted.current = true;
        setReady(true);
        root.dataset.phase = 'moving';

        const openDashboard = () => {
            sessionStorage.setItem('betwin-arrived-from-welcome', 'true');
            window.location.assign(dashboardUrl);
        };

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            openDashboard();
            return;
        }

        const rect = word.getBoundingClientRect();
        const styles = window.getComputedStyle(word);
        const targetLeft = Number.parseFloat(styles.getPropertyValue('--betwin-corner-left'));
        const targetTop = Number.parseFloat(styles.getPropertyValue('--betwin-corner-top'));
        const targetSize = Number.parseFloat(styles.getPropertyValue('--betwin-corner-size'));
        const sourceSize = Number.parseFloat(styles.fontSize);
        const targetScale = targetSize / sourceSize;

        gsap.timeline({ onComplete: openDashboard })
            .to(toolsBox, {
                opacity: 0,
                y: -6,
                duration: 0.25,
                ease: 'power2.out',
            })
            .set(toolsBox, { visibility: 'hidden' })
            .to(word, {
                x: targetLeft - rect.left,
                y: targetTop - rect.top,
                scale: targetScale,
                transformOrigin: 'top left',
                duration: 0.9,
                ease: 'power3.inOut',
            });
    };

    return (
        <main ref={container} className="welcome" aria-busy={!ready}>
            <div className="lockup">
                <h1 className="word-box" aria-label="BetWin">
                    <BetWinWord className="word" />
                </h1>
                <div className="tools-box" aria-label="tools v1">
                    <DownloadingText
                        text="tools v1"
                        active={downloadingActive}
                        start={downloadingStarted}
                        settled={ready}
                        onCursorVisible={() => { if (container.current) container.current.dataset.phase = 'cursor'; }}
                        onTypingStart={() => { if (container.current) container.current.dataset.phase = 'typing'; }}
                        onSettled={handleDownloadingSettled}
                    />
                </div>
            </div>
            <p className="sr-only" role="status">{ready ? 'Opening product selection.' : 'Loading BetWin Tools.'}</p>
        </main>
    );
}
