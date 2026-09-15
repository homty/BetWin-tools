import { FormEvent, useEffect, useState } from 'react';
import BetWinWord from '../../components/brand/BetWinWord';
import { AniSlotJob, generateAniSlot, getAniSlotJob } from '../../services/anislot';

type AniSlotProps = {
    backUrl: string;
    coreUrl?: string;
};

export default function AniSlot({ backUrl, coreUrl }: AniSlotProps) {
    const [image, setImage] = useState<File | null>(null);
    const [prompt, setPrompt] = useState('');
    const [seed, setSeed] = useState('');
    const [width, setWidth] = useState('');
    const [job, setJob] = useState<AniSlotJob | null>(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');

    useEffect(() => {
        if (!image) {
            setPreviewUrl('');
            return;
        }
        const url = URL.createObjectURL(image);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [image]);

    useEffect(() => {
        if (!job || ['completed', 'failed', 'canceled'].includes(job.status)) return;
        let cancelled = false;
        let timer: number | undefined;

        const poll = async () => {
            try {
                const updated = await getAniSlotJob(job.itemId);
                if (cancelled) return;
                setJob(updated);
                if (!['completed', 'failed', 'canceled'].includes(updated.status)) {
                    timer = window.setTimeout(poll, 1200);
                }
            } catch (requestError) {
                if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Could not check AniSlot status.');
            }
        };

        void poll();
        return () => {
            cancelled = true;
            if (timer !== undefined) window.clearTimeout(timer);
        };
    }, [job?.itemId]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!image || submitting) return;
        setSubmitting(true);
        setError('');
        setJob(null);
        try {
            const queued = await generateAniSlot({image, positivePrompt: prompt, seed, width});
            setJob({itemId: queued.itemId, status: 'queued'});
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'AniSlot generation could not start.');
        } finally {
            setSubmitting(false);
        }
    };

    const status = job?.status.replace('_', ' ') || 'ready';

    return (
        <main className="anislot-page">
            <a className="anislot-brand" href={backUrl} aria-label="Back to product selection"><BetWinWord className="anislot-brand__name" /></a>
            <section className="anislot-workbench" aria-labelledby="anislot-title">
                <header className="anislot-workbench__header">
                    <span className="anislot-workbench__eyebrow">AniSlot Core</span>
                    <h1 id="anislot-title">Create a slot symbol</h1>
                    <p>Upload a reference, describe the finish, and generate it with your local InvokeAI engine.</p>
                </header>

                <form className="anislot-form" onSubmit={submit}>
                    <label className="anislot-file">
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setImage(event.target.files?.[0] || null)} />
                        {previewUrl ? <img src={previewUrl} alt="Selected source" /> : <span><strong>Choose reference image</strong><small>PNG, JPG, or WebP</small></span>}
                    </label>

                    <label className="anislot-field">
                        <span>Prompt <em>optional</em></span>
                        <textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Describe the desired symbol finish…" rows={4} />
                    </label>

                    <div className="anislot-form__row">
                        <label className="anislot-field"><span>Seed <em>optional</em></span><input value={seed} inputMode="numeric" onChange={event => setSeed(event.target.value)} placeholder="Random" /></label>
                        <label className="anislot-field"><span>Width <em>optional</em></span><input value={width} inputMode="numeric" onChange={event => setWidth(event.target.value)} placeholder="Auto" /></label>
                    </div>

                    {error && <p className="anislot-error" role="alert">{error}</p>}
                    <button className="anislot-generate" type="submit" disabled={!image || submitting}>{submitting ? 'Queueing…' : 'Generate symbol'}</button>
                </form>

                {job && <section className={`anislot-job anislot-job--${job.status}`} aria-live="polite">
                    <div><span>Generation</span><strong>{status}</strong></div>
                    {job.error && <p className="anislot-error">{job.error}</p>}
                    {job.imageUrl && <img className="anislot-result" src={job.imageUrl} alt="Generated AniSlot symbol" />}
                </section>}
            </section>
        </main>
    );
}
