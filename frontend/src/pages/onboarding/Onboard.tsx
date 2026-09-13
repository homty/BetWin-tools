import { FormEvent, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import BetWinWord from '../../components/brand/BetWinWord';

gsap.registerPlugin(useGSAP);

type ProductId = 'anislot' | 'prediction-market';

type OnboardProps = {
    anislotUrl: string;
    predictionMarketUrl: string;
    backUrl: string;
};

type Product = {
    id: ProductId;
    name: string;
    description: string;
    url: string;
    icon: string;
};

function Brand() {
    return (
        <a className="onboard-brand" href="/" aria-label="BetWin Tools home">
            <BetWinWord className="onboard-brand__name" />
        </a>
    );
}

export default function Onboard({ anislotUrl, predictionMarketUrl, backUrl }: OnboardProps) {
    const container = useRef<HTMLElement>(null);
    const [selected, setSelected] = useState<ProductId | null>(null);
    const arrivedFromWelcome = useRef(sessionStorage.getItem('betwin-arrived-from-welcome') === 'true');
    const products: Product[] = [
        { id: 'anislot', name: 'AniSlot', description: 'Slots in anime-themed slots', url: anislotUrl, icon: '/static/frontend/icons/joystick-05.svg' },
        { id: 'prediction-market', name: 'Prediction Market', description: 'Predict real events, or make your own market', url: predictionMarketUrl, icon: '/static/frontend/icons/chart-candle.svg' },
    ];

    useGSAP(() => {
        if (arrivedFromWelcome.current) {
            sessionStorage.removeItem('betwin-arrived-from-welcome');
        }

        const media = gsap.matchMedia();
        media.add('(prefers-reduced-motion: no-preference)', () => {
            const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
            if (!arrivedFromWelcome.current) {
                timeline.from('.onboard-brand', { opacity: 0, x: -18, duration: 0.45 });
            }
            timeline
                .from('.product-panel', { opacity: 0, y: 24, scale: 0.98, duration: 0.55 }, arrivedFromWelcome.current ? 0 : '-=0.15')
                .from('.product-panel__badge', { opacity: 0, scale: 0.65, duration: 0.35 }, '-=0.25')
                .from('.product-option', { opacity: 0, y: 12, duration: 0.35, stagger: 0.1 }, '-=0.15');
        });
        return () => media.revert();
    }, { scope: container });

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const product = products.find(item => item.id === selected);
        if (product) window.location.assign(product.url);
    };

    return (
        <main ref={container} className="onboard-page">
            <Brand />
            <form className="product-panel" onSubmit={handleSubmit}>
                <div className="product-panel__badge">
                    <img src="/static/frontend/icons/basketball.svg" alt="" aria-hidden="true" />
                </div>
                <header className="product-panel__header">
                    <h1>Product Selection</h1>
                    <p>Before we get started <br/> we just need to select your product</p>
                </header>
                <div className="product-options" role="radiogroup" aria-label="Products">
                    {products.map(product => (
                        <button
                            className="product-option"
                            data-selected={selected === product.id}
                            key={product.id}
                            type="button"
                            role="radio"
                            aria-checked={selected === product.id}
                            onClick={() => setSelected(product.id)}
                        >
                            <span className="product-option__icon">
                                <img src={product.icon} alt="" aria-hidden="true" />
                            </span>
                            <span className="product-option__copy">
                                <strong>{product.name}</strong>
                                <span>{product.description}</span>
                            </span>
                            <span className="product-option__check" aria-hidden="true">✓</span>
                        </button>
                    ))}
                </div>
                <button className="product-panel__continue" type="submit" disabled={!selected}>Continue</button>
                <a className="product-panel__back" href={backUrl}>Go back</a>
            </form>
        </main>
    );
}
