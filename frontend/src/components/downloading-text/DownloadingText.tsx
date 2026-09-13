import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { TextPlugin } from 'gsap/TextPlugin';
import './downloadingText.css';

gsap.registerPlugin(useGSAP, TextPlugin);

type DownloadingTextProps = {
    text: string;
    active: boolean;
    start: boolean;
    className?: string;
    cursor?: string;
    cursorDelay?: number;
    typeDuration?: number;
    holdDuration?: number;
    deleteDuration?: number;
    restartDelay?: number;
    settled?: boolean;
    onCursorVisible?: () => void;
    onTypingStart?: () => void;
    onSettled?: () => void;
};

export default function DownloadingText({
    text,
    active,
    start,
    className = '',
    cursor = '|',
    cursorDelay = 0.3,
    typeDuration = 1,
    holdDuration = 0.9,
    deleteDuration = 1,
    restartDelay = 0.5,
    settled = false,
    onCursorVisible,
    onTypingStart,
    onSettled,
}: DownloadingTextProps) {
    const container = useRef<HTMLSpanElement>(null);
    const activeRef = useRef(active);
    activeRef.current = active;

    useGSAP(() => {
        const root = container.current;
        const textElement = root?.querySelector<HTMLElement>('.downloading-text__value');
        if (!root || !textElement) return;

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const deleteRightToLeft = (timeline: gsap.core.Timeline) => {
            const stepDuration = deleteDuration / text.length;
            for (let index = text.length - 1; index >= 0; index -= 1) {
                timeline.to({}, {
                    duration: stepDuration,
                    onComplete: () => {
                        textElement.textContent = text.slice(0, index);
                    },
                });
            }
        };

        if (!start) {
            gsap.set(textElement, { text: '' });
            root.dataset.phase = 'idle';
            return;
        }

        if (reduce) {
            gsap.set(textElement, { text });
            root.dataset.phase = 'settled';
            onSettled?.();
            return;
        }

        let disposed = false;
        let timeline: gsap.core.Timeline | undefined;
        const play = () => {
            if (disposed) return;

            timeline = gsap.timeline({
                onComplete: () => {
                    if (disposed) return;
                    if (activeRef.current) play();
                    else {
                        root.dataset.phase = 'settled';
                        onSettled?.();
                    }
                },
            });

            timeline
                .call(() => {
                    root.dataset.phase = 'cursor';
                    onCursorVisible?.();
                })
                .to({}, { duration: cursorDelay })
                .call(() => {
                    root.dataset.phase = 'typing';
                    onTypingStart?.();
                })
                .set(textElement, { text: '' })
                .to(textElement, { text, duration: typeDuration, ease: 'none' })
                .to({}, { duration: holdDuration });

            if (activeRef.current) {
                deleteRightToLeft(timeline);
                timeline.to({}, { duration: restartDelay });
            }
        };

        play();
        return () => {
            disposed = true;
            timeline?.kill();
            gsap.killTweensOf(textElement);
        };
    }, { dependencies: [start, active, text, cursorDelay, typeDuration, holdDuration, deleteDuration, restartDelay], scope: container });

    return (
        <span ref={container} className={`downloading-text ${className}`} data-phase="idle" aria-label={text}>
            <span className="downloading-text__line" aria-hidden="true">
                <span className="downloading-text__value" />
                <span className={'downloading-text__cursor' + (settled ? ' is-settled' : '')}>{cursor}</span>
            </span>
        </span>
    );
}
