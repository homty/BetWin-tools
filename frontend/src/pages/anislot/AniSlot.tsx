import { FormEvent, useEffect, useState } from 'react';
import BetWinWord from '../../components/brand/BetWinWord';
import { ApiProduct, fetchProducts } from '../../services/products';

export default function AniSlot({ backUrl }: { backUrl: string }) {
    const [product, setProduct] = useState<ApiProduct | null>(null);
    const [error, setError] = useState('');
    const [repositoryUrl, setRepositoryUrl] = useState('');

    useEffect(() => {
        fetchProducts()
            .then(products => setProduct(products.find(item => item.name === 'AniSlot') || null))
            .catch((requestError: Error) => setError(requestError.message));
    }, []);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!repositoryUrl.trim()) return;
        // The next step will send this URL to Django for validation and setup.
        console.log('Repository selected for setup:', repositoryUrl.trim());
    };

    return (
        <main className="anislot-page">
            <a className="anislot-brand" href={backUrl} aria-label="Back to product selection">
                <BetWinWord className="anislot-brand__name" />
            </a>
            <form className="anislot-card" onSubmit={handleSubmit}>
                <div className="anislot-card__icon" aria-hidden="true">
                    <img src="/static/frontend/icons/anislot-gradient.svg" alt="" />
                </div>
                <h1>{product?.name || 'AniSlot'}</h1>
                <p className="anislot-card__description">
                    {product?.description || 'Configure your local InvokeAI workflow.'}
                </p>
                <label className="anislot-repository">
                    <strong>GitHub Link</strong>
                    <input
                        className={repositoryUrl.trim() ? 'is-valid' : ''}
                        type="url"
                        value={repositoryUrl}
                        onChange={event => setRepositoryUrl(event.target.value)}
                        placeholder="https://github.com/owner/repository.git"
                        required
                    />
                </label>
                {error && <p className="anislot-error" role="alert">{error}</p>}
       
                <button className="anislot-card__button" type="submit" disabled={!repositoryUrl.trim()}>Continue</button>
                <a className="anislot-card__back" href={backUrl}>Back to products</a>
            </form>
        </main>
    );
}
