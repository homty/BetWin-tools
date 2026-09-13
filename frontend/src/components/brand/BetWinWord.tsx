import { useLayoutEffect, useRef } from 'react';
import './betWinWord.css';

export default function BetWinWord({ className = '' }: { className?: string }) {
    const word = useRef<HTMLSpanElement>(null);

    useLayoutEffect(() => {
        const win = Array.from(word.current?.querySelectorAll<HTMLElement>('.betwin-word__letter--win') ?? []);
        const winWidth = win.reduce((sum, letter) => sum + letter.offsetWidth, 0);
        let offset = 0;

        win.forEach(letter => {
            letter.style.backgroundSize = `${winWidth}px 100%`;
            letter.style.backgroundPosition = `${-offset}px 0`;
            offset += letter.offsetWidth;
        });
    }, []);

    return (
        <span ref={word} className={`betwin-word ${className}`} aria-label="BetWin">
            {[...'BetWin'].map((character, index) => (
                <span
                    key={index}
                    className={`betwin-word__letter${index > 2 ? ' betwin-word__letter--win' : ''}`}
                    aria-hidden="true"
                >
                    {character}
                </span>
            ))}
        </span>
    );
}
