import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { TextPlugin } from 'gsap/TextPlugin';
import { isLoading, subscribe } from './loading';

gsap.registerPlugin(useGSAP, TextPlugin);

type WaitingMode = 'typing';
let waitingMode: WaitingMode = 'typing';

export default function Welcome({ dashboardUrl }: { dashboardUrl: string }) {
    const container = useRef<HTMLElement>(null);
    const [ready, setReady] = useState(false);

    useGSAP(() => {
        const media = gsap.matchMedia();
        media.add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, context => {
            const root = container.current!;
            const subtitle = root.querySelector<HTMLElement>('.tools-text')!;
            const chars = Array.from(root.querySelectorAll<HTMLElement>('.letter'));
            const win = chars.slice(3);
            const winWidth = win.reduce((sum, char) => sum + char.offsetWidth, 0);
            let offset = 0;
            win.forEach(char => {
                char.style.backgroundSize = winWidth + 'px 100%';
                char.style.backgroundPosition = -offset + 'px 0';
                offset += char.offsetWidth;
            });

            let busy = false;
            let disposed = false;
            const reduce = Boolean(context.conditions?.reduce);
            let cycle: gsap.core.Timeline | undefined;

            const finish = () => {
                busy = false;
                setReady(!isLoading());
                root.dataset.phase = isLoading() ? 'waiting' : 'ready';
            };

            const deleteRightToLeft = (timeline: gsap.core.Timeline, element: HTMLElement, text: string, duration: number) => {
                const stepDuration = duration / text.length;
                for (let index = text.length - 1; index >= 0; index -= 1) {
                    timeline.to({}, {
                        duration: stepDuration,
                        onComplete: () => {
                            element.textContent = text.slice(0, index);
                        },
                    });
                }
            };

            const runCycle = context.add('runCycle', () => {
                if (disposed || busy) return;
                if (reduce) { finish(); return; }
                busy = true;
                setReady(false);
                root.dataset.phase = 'typing';
                if (cycle) { cycle.restart(); return; }
                cycle = gsap.timeline({
                    onComplete: () => {
                        busy = false;
                        if (!disposed && isLoading()) runCycle();
                        else if (!disposed) finish();
                    },
                });
                cycle.set(subtitle, { text: '' })
                        .to(subtitle, { text: 'tools v1', duration: 1, ease: 'none' })
                        .to({}, { duration: 0.9 });
                deleteRightToLeft(cycle, subtitle, 'tools v1', 1);
                cycle.to({}, { duration: 0.5 });
            });

            if (reduce) {
                gsap.set(subtitle, { text: 'tools v1' });
                finish();
            } else {
                busy = true;
                setReady(false);
                root.dataset.phase = 'intro';
                gsap.set(subtitle, { text: '' });
                const intro = gsap.timeline({
                    onComplete: () => {
                        busy = false;
                        if (!disposed && isLoading()) runCycle();
                        else if (!disposed) finish();
                    },
                });
                intro.from(chars, { x: 42, opacity: 0, duration: 0.65, stagger: 0.1, ease: 'power2.out' })
                    .call(() => { root.dataset.phase = 'cursor'; })
                    .to({}, { duration: 0.3 })
                    .call(() => { root.dataset.phase = 'typing'; })
                    .to(subtitle, { text: 'tools v1', duration: 1, ease: 'none' })
                    .to({}, { duration: 0.9 });
                if (isLoading()) {
                    deleteRightToLeft(intro, subtitle, 'tools v1', 1);
                    intro.to({}, { duration: 0.5 });
                }
            }

            const unsubscribe = subscribe(() => {
                if (isLoading() && !busy) runCycle();
                else if (!busy) finish();
            });
            return () => {
                disposed = true;
                unsubscribe();
                cycle?.kill();
            };
        });
        return () => media.revert();
    }, { scope: container });

    return (
        <main ref={container} className="welcome" aria-busy={!ready}>
            <div className="lockup">
                <h1 className="word-box" aria-label="BetWin">
                    <span className="word" aria-hidden="true">
                        {[...'BetWin'].map((char, i) => <span key={i} className={'letter' + (i > 2 ? ' win-letter' : '')}>{char}</span>)}
                    </span>
                </h1>
                <div className="tools-box" aria-label="tools v1">
                    <span className="tools-line" aria-hidden="true">
                        <span className="tools-text">tools v1</span>
                        <span className={'caret' + (ready ? ' settled' : '')}>|</span>
                    </span>
                </div>
            </div>
            <a className="enter" href={dashboardUrl} hidden={!ready}>Enter BetWin Tools <span aria-hidden="true">→</span></a>
            <p className="sr-only" role="status">{ready ? 'BetWin Tools ready.' : 'Loading BetWin Tools.'}</p>
        </main>
    );
}
