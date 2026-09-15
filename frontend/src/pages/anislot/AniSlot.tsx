import {
    CSSProperties,
    ChangeEvent,
    ClipboardEvent,
    DragEvent,
    FormEvent,
    useEffect,
    useRef,
    useState,
} from 'react';
import BetWinWord from '../../components/brand/BetWinWord';
import { AniSlotJob, generateAniSlot, getAniSlotJob } from '../../services/anislot';
import { ApiProduct, fetchProducts, fetchSetupStatus, startSetup } from '../../services/products';

type ResourceMetric = {
    key: 'gpu' | 'vram' | 'cpu' | 'ram';
    label: string;
    value: number;
};

type WorkspaceSnapshot = {
    status: string;
    currentNode: string;
    estimatedTime: string;
    resources: ResourceMetric[];
};

const workspacePlaceholder: WorkspaceSnapshot = {
    status: 'Ready',
    currentNode: 'Waiting for a job',
    estimatedTime: '—',
    resources: [
        { key: 'gpu', label: 'GPU', value: 68 },
        { key: 'vram', label: 'VRAM', value: 54 },
        { key: 'cpu', label: 'CPU', value: 31 },
        { key: 'ram', label: 'RAM', value: 46 },
    ],
};

function SvgPlaceholder({ name }: { name: string }) {
    return (
        <span className="workspace-svg-placeholder" data-svg-placeholder={name} aria-hidden="true">
            <span className="workspace-svg-placeholder__head" />
            <span className="workspace-svg-placeholder__body" />
        </span>
    );
}

function ReferenceArtwork() {
    return (
        <span className="reference-artwork" data-svg-placeholder="reference-image-upload" aria-hidden="true">
            <span className="reference-artwork__frame" />
            <span className="reference-artwork__sun" />
            <span className="reference-artwork__mountains" />
            <span className="reference-artwork__arrow" />
        </span>
    );
}

function MetricDial({ metric }: { metric: ResourceMetric }) {
    const safeValue = Math.min(100, Math.max(0, metric.value));
    const style = { '--meter-value': `${safeValue * 3.6}deg` } as CSSProperties;

    return (
        <article
            className="metric-dial"
            data-backend-field={`resources.${metric.key}`}
            style={style}
            aria-label={`${metric.label} usage ${safeValue}%`}
        >
            <div className="metric-dial__inner">
                <strong>{metric.label}</strong>
                <span>{safeValue}%</span>
            </div>
        </article>
    );
}

function WorkspaceNav({
    dashboardUrl,
    workflowUrl,
    active,
}: {
    dashboardUrl: string;
    workflowUrl: string;
    active: 'dashboard' | 'workflow';
}) {
    return (
        <nav className="workspace-nav" aria-label="Main navigation">
            <a className={`workspace-nav__link${active === 'dashboard' ? ' is-active' : ''}`} href={dashboardUrl} aria-current={active === 'dashboard' ? 'page' : undefined}>
                <span className="workspace-nav__icon" aria-hidden="true">▦</span>
                <span>Dashboard</span>
            </a>
            <a className={`workspace-nav__link${active === 'workflow' ? ' is-active' : ''}`} href={workflowUrl} aria-current={active === 'workflow' ? 'page' : undefined}>
                <span className="workspace-nav__icon" aria-hidden="true">✦</span>
                <span>Workflow<small>Design Helper</small></span>
            </a>
        </nav>
    );
}

function Dashboard({ backUrl, dashboardUrl, workflowUrl }: { backUrl: string; dashboardUrl: string; workflowUrl: string }) {
    const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(workspacePlaceholder);
    const [job, setJob] = useState<AniSlotJob | null>(null);
    const [dashboardScale, setDashboardScale] = useState(() => window.innerWidth <= 1050 ? 1 : window.innerWidth / 1760);
    const [modelRole, setModelRole] = useState<'finisher' | 'creative'>(() => localStorage.getItem('anislot.modelRole') === 'creative' ? 'creative' : 'finisher');
    const [outputAmount, setOutputAmount] = useState(() => Number(localStorage.getItem('anislot.outputAmount') || '3'));
    const [angleExplorer, setAngleExplorer] = useState(() => localStorage.getItem('anislot.angleExplorer') !== 'false');
    const [characterPose, setCharacterPose] = useState(() => localStorage.getItem('anislot.characterPose') !== 'false');

    useEffect(() => {
        const itemId = localStorage.getItem('anislot.activeJobId');
        if (itemId) setJob({ itemId, status: 'queued' });
    }, []);

    useEffect(() => { localStorage.setItem('anislot.modelRole', modelRole); }, [modelRole]);
    useEffect(() => { localStorage.setItem('anislot.outputAmount', String(outputAmount)); }, [outputAmount]);
    useEffect(() => { localStorage.setItem('anislot.angleExplorer', String(angleExplorer)); }, [angleExplorer]);
    useEffect(() => { localStorage.setItem('anislot.characterPose', String(characterPose)); }, [characterPose]);

    useEffect(() => {
        const updateScale = () => setDashboardScale(window.innerWidth <= 1050 ? 1 : window.innerWidth / 1760);
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, []);

    useEffect(() => {
        if (!job || ['completed', 'failed', 'canceled'].includes(job.status)) return;
        let cancelled = false;
        let timer: number | undefined;
        const poll = async () => {
            try {
                const updated = await getAniSlotJob(job.itemId);
                if (cancelled) return;
                setJob(updated);
                setSnapshot(previous => ({
                    ...previous,
                    status: updated.status.replace('_', ' '),
                    currentNode: updated.status === 'in_progress' ? 'InvokeAI workflow is running' : 'Waiting for InvokeAI',
                    estimatedTime: updated.status === 'in_progress' ? 'Processing' : '—',
                }));
                if (!['completed', 'failed', 'canceled'].includes(updated.status)) timer = window.setTimeout(poll, 1200);
            } catch {
                if (!cancelled) {
                    setSnapshot(previous => ({ ...previous, status: 'Reconnecting', currentNode: 'Waiting for InvokeAI to respond', estimatedTime: '—' }));
                    timer = window.setTimeout(poll, 2500);
                }
            }
        };
        void poll();
        return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
    }, [job?.itemId]);

    return (
        <main
            className="workspace-page workspace-page--dashboard"
            style={{ '--dashboard-scale': dashboardScale } as CSSProperties}
        >
            <aside className="workspace-rail">
                <a className="workspace-brand" href={backUrl} aria-label="Back to products"><span className="workspace-brand__name" aria-hidden="true"><span>B</span><span>W</span></span></a>
                <WorkspaceNav dashboardUrl={dashboardUrl} workflowUrl={workflowUrl} active="dashboard" />
                <span className="workspace-rail__glow" aria-hidden="true" />
            </aside>
            <div className="workspace-shell workspace-shell--dashboard">
                <div className="dashboard-main-column">
                    <div className="dashboard-overview">
                        <section className="metrics-grid dashboard-metrics" aria-label="System resource usage">{snapshot.resources.map(metric => <MetricDial key={metric.key} metric={metric} />)}</section>
                        <section className="workflow-summary dashboard-status" aria-label="Workflow status">
                            <article className="summary-card"><span>Status</span><strong className="summary-card__status"><i />{snapshot.status}</strong></article>
                            <article className="summary-card"><span>Current node</span><strong>{snapshot.currentNode}</strong></article>
                            <article className="summary-card"><span>Estimated time</span><strong>{snapshot.estimatedTime}</strong></article>
                        </section>
                    </div>
                    <section className="dashboard-output">
                        <header className="panel-heading"><span>Gallery</span></header>
                        {job?.imageUrl ? <img src={job.imageUrl} alt="Final generated slot concept" /> : <span><strong>Final Generation will appear here</strong><small>Start a workflow to track its progress and view the saved result.</small></span>}
                        {job?.error && <p className="workspace-error" role="alert">{job.error}</p>}
                    </section>
                </div>
                <div className="dashboard-side-column">
                    <aside className="configuration-panel dashboard-configuration" aria-label="Model configuration">
                        <h1>Model configuration</h1>
                        <label className="configuration-row"><SvgPlaceholder name="model-role" /><span className="configuration-row__copy"><strong>Model role</strong><small>Select the model&apos;s behavior type</small></span><select value={modelRole} onChange={event => setModelRole(event.target.value as 'finisher' | 'creative')}><option value="finisher">Finisher</option><option value="creative">Creative</option></select></label>
                        <label className="configuration-row"><SvgPlaceholder name="image-scale-divider" /><span className="configuration-row__copy"><strong>Image scale divider</strong><small>Select image downscaling ratio</small></span><select defaultValue="2"><option value="1">1x</option><option value="2">2x</option><option value="4">4x</option></select></label>
                        <label className="configuration-row"><SvgPlaceholder name="angle-explorer" /><span className="configuration-row__copy"><strong>Angle explorer</strong><small>Generate different angles</small></span><input className="toggle-input" type="checkbox" checked={angleExplorer} onChange={event => setAngleExplorer(event.target.checked)} /><span className="toggle" aria-hidden="true"><i /></span></label>
                        <label className="configuration-row"><SvgPlaceholder name="character-pose" /><span className="configuration-row__copy"><strong>Character pose</strong><small>Generate different poses</small></span><input className="toggle-input" type="checkbox" checked={characterPose} onChange={event => setCharacterPose(event.target.checked)} /><span className="toggle" aria-hidden="true"><i /></span></label>
                        <label className="configuration-row"><SvgPlaceholder name="output-amount" /><span className="configuration-row__copy"><strong>Amount of output</strong><small>Select number of generated images</small></span><select value={outputAmount} onChange={event => setOutputAmount(Number(event.target.value))}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>
                    </aside>
                    <section className="model-roles-panel" aria-label="Model roles">
                    <h2>Model role</h2>
                    <button className="model-role-card" type="button" onClick={() => setModelRole('finisher')} data-active={modelRole === 'finisher'}>
                        <SvgPlaceholder name="finisher-role" />
                        <span><strong>Detailer</strong><small>Finish reference to production style</small></span>
                        <img src="/static/frontend/icons/edit.svg" alt="Edit Detailer role" />
                    </button>
                    <button className="model-role-card" type="button" onClick={() => setModelRole('creative')} data-active={modelRole === 'creative'}>
                        <SvgPlaceholder name="creative-role" />
                        <span><strong>Brainstormer</strong><small>Help to find ideas for design</small></span>
                        <img src="/static/frontend/icons/edit.svg" alt="Edit Brainstormer role" />
                    </button>
                    <button className="model-role-add" type="button" aria-label="Add model role">
                        <img src="/static/frontend/icons/add.svg" alt="" />
                    </button>
                    </section>
                </div>
            </div>
        </main>
    );
}

function SetupCard({
    backUrl,
    product,
    error,
    repositoryUrl,
    setupStatus,
    isCheckingSetup,
    isSubmitting,
    onRepositoryChange,
    onSubmit,
}: {
    backUrl: string;
    product: ApiProduct | null;
    error: string;
    repositoryUrl: string;
    setupStatus: string;
    isCheckingSetup: boolean;
    isSubmitting: boolean;
    onRepositoryChange: (value: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
    return (
        <main className="anislot-page anislot-page--setup">
            <a className="anislot-brand" href={backUrl} aria-label="Back to product selection">
                <BetWinWord className="anislot-brand__name" />
            </a>
            <form className="anislot-card" onSubmit={onSubmit}>
                <div className="anislot-card__icon" aria-hidden="true">
                    <img src="/static/frontend/icons/anislot-gradient.svg" alt="" />
                </div>
                <h1>{product?.name || 'AniSlot'}</h1>
                <p className="anislot-card__description">
                    {product?.description || 'Configure your local InvokeAI workflow.'}
                </p>
                {!isCheckingSetup && (
                    <label className="anislot-repository">
                        <strong>GitHub Link</strong>
                        <input
                            className={repositoryUrl.trim() ? 'is-valid' : ''}
                            type="text"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            value={repositoryUrl}
                            onChange={event => onRepositoryChange(event.target.value)}
                            placeholder="git@github.com:owner/repository.git"
                            required
                        />
                    </label>
                )}
                {error && <p className="anislot-error" role="alert">{error}</p>}
                {setupStatus && <p className="anislot-setup-status" role="status">{setupStatus}</p>}
                <button
                    className="anislot-card__button"
                    type="submit"
                    disabled={isCheckingSetup || !repositoryUrl.trim() || isSubmitting}
                >
                    {isCheckingSetup ? 'Checking...' : isSubmitting ? 'Cloning...' : 'Continue'}
                </button>
                <a className="anislot-card__back" href={backUrl}>Back to products</a>
            </form>
        </main>
    );
}

function Workspace({ backUrl, dashboardUrl, workflowUrl }: { backUrl: string; dashboardUrl: string; workflowUrl: string }) {
    const imageInput = useRef<HTMLInputElement>(null);
    const slotConceptInput = useRef<HTMLInputElement>(null);
    const [referenceImage, setReferenceImage] = useState<string>('');
    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    const [referenceName, setReferenceName] = useState('');
    const [activePanel, setActivePanel] = useState<'reference' | 'concept'>('reference');
    const [slotConceptImage, setSlotConceptImage] = useState('');
    const [slotConceptFile, setSlotConceptFile] = useState<File | null>(null);
    const [slotConceptName, setSlotConceptName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [positivePrompt, setPositivePrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState('');

    useEffect(() => () => {
        if (referenceImage.startsWith('blob:')) URL.revokeObjectURL(referenceImage);
    }, [referenceImage]);

    useEffect(() => () => {
        if (slotConceptImage.startsWith('blob:')) URL.revokeObjectURL(slotConceptImage);
    }, [slotConceptImage]);

    const useImage = (target: 'reference' | 'concept', file?: File) => {
        if (!file?.type.startsWith('image/')) return;
        const preview = URL.createObjectURL(file);
        if (target === 'reference') {
            setReferenceImage(previous => { if (previous.startsWith('blob:')) URL.revokeObjectURL(previous); return preview; });
            setReferenceFile(file);
            setReferenceName(file.name || 'Pasted image');
        } else {
            setSlotConceptImage(previous => { if (previous.startsWith('blob:')) URL.revokeObjectURL(previous); return preview; });
            setSlotConceptFile(file);
            setSlotConceptName(file.name || 'Pasted image');
        }
    };

    const handleGenerate = async () => {
        if (!referenceFile || isGenerating) {
            setGenerationError('Add a reference image before generating.');
            return;
        }
        const modelRole = localStorage.getItem('anislot.modelRole') === 'creative' ? 'creative' : 'finisher';
        const outputAmount = Number(localStorage.getItem('anislot.outputAmount') || '3');
        const modeInstruction = modelRole === 'finisher'
            ? 'Preserve the object identity, silhouette, perspective, and key color palette. Improve only finish and production quality.'
            : 'Keep the object identity, perspective, and key color family. Explore alternative details, materials, and decorative ideas.';
        setGenerationError('');
        setIsGenerating(true);
        try {
            const queued = await generateAniSlot({
                image: referenceFile,
                slotConceptImage: slotConceptFile || undefined,
                positivePrompt: [modeInstruction, positivePrompt].filter(Boolean).join('\n\n'),
                negativePrompt,
                runs: modelRole === 'creative' ? outputAmount : 1,
            });
            localStorage.setItem('anislot.activeJobId', queued.itemId);
            window.location.assign(dashboardUrl);
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : 'Generation could not start.';
            setGenerationError(message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
        useImage('reference', event.target.files?.[0]);
        event.target.value = '';
    };

    const handleSlotConceptInput = (event: ChangeEvent<HTMLInputElement>) => {
        useImage('concept', event.target.files?.[0]);
        event.target.value = '';
    };

    const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setIsDragging(false);
        useImage('reference', event.dataTransfer.files?.[0]);
    };

    const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
        const image = Array.from(event.clipboardData.items)
            .find(item => item.type.startsWith('image/'))
            ?.getAsFile();
        if (image) {
            event.preventDefault();
            useImage(activePanel, image);
        }
    };

    return (
        <main className="workspace-page" onPaste={handlePaste}>
            <aside className="workspace-rail">
                <a className="workspace-brand" href={backUrl} aria-label="Back to products">
                    <span className="workspace-brand__name" aria-hidden="true">
                        <span>B</span><span>W</span>
                    </span>
                </a>
                <WorkspaceNav dashboardUrl={dashboardUrl} workflowUrl={workflowUrl} active="workflow" />
                <span className="workspace-rail__glow" aria-hidden="true" />
            </aside>

            <div className="workspace-shell workspace-shell--workflow">
                <section className="workspace-main" aria-label="Generation workspace">
                    <section className="reference-panel">
                        <header className="panel-heading">
                            <div className="panel-heading__tabs" role="tablist" aria-label="Artwork view">
                                <button className={activePanel === 'reference' ? 'is-active' : ''} type="button" role="tab" aria-selected={activePanel === 'reference'} onClick={() => setActivePanel('reference')}>Reference image</button>
                                <button className={activePanel === 'concept' ? 'is-active' : ''} type="button" role="tab" aria-selected={activePanel === 'concept'} onClick={() => setActivePanel('concept')}>Slot Concept</button>
                            </div>
                        </header>
                        {activePanel === 'reference' ? (
                            <div className="reference-panel__content">
                                <div className="reference-input-wrap">
                                    <input ref={imageInput} className="visually-hidden" type="file" accept="image/*" onChange={handleFileInput} tabIndex={-1} />
                                    <button className="reference-input" data-dragging={isDragging} type="button" onClick={() => imageInput.current?.click()} onDragEnter={() => setIsDragging(true)} onDragLeave={() => setIsDragging(false)} onDragOver={event => event.preventDefault()} onDrop={handleDrop} aria-label="Choose, drop, or paste a thematic reference image">
                                        {referenceImage ? <img src={referenceImage} alt={referenceName || 'Selected thematic reference'} /> : <><ReferenceArtwork /><span className="reference-input__title">Add thematic image</span><span className="reference-input__hint">Click, drop, or paste</span></>}
                                    </button>
                                    {referenceImage && <button className="reference-input__replace" type="button" onClick={() => imageInput.current?.click()}>Replace image</button>}
                                </div>
                            </div>
                        ) : activePanel === 'concept' ? (
                            <div className="reference-panel__content">
                                <div className="reference-input-wrap">
                                    <input ref={slotConceptInput} className="visually-hidden" type="file" accept="image/*" onChange={handleSlotConceptInput} tabIndex={-1} />
                                    <button className="reference-input" type="button" onClick={() => slotConceptInput.current?.click()} aria-label="Choose or paste a slot concept visual">
                                        {slotConceptImage ? <img src={slotConceptImage} alt={slotConceptName || 'Selected slot concept visual'} /> : <><ReferenceArtwork /><span className="reference-input__title">Add slot concept visual</span><span className="reference-input__hint">Click or paste an image</span></>}
                                    </button>
                                    {slotConceptImage && <button className="reference-input__replace" type="button" onClick={() => slotConceptInput.current?.click()}>Replace image</button>}
                                </div>
                                <div className="slot-concept-copy">
                                    <strong>Slot Concept</strong>
                                    <p>Add an image showing how the slot should look: its composition, rendering, color treatment, interface language, or atmosphere.</p>
                                </div>
                            </div>
                        ) : null}
                    </section>

                    <div className="prompt-grid">
                        <label className="prompt-field prompt-field--large">
                            <span>Positive prompt</span>
                            <textarea
                                data-backend-input="positivePrompt"
                                placeholder="Describe what should appear in the result..."
                                value={positivePrompt}
                                onChange={event => setPositivePrompt(event.target.value)}
                            />
                        </label>
                        <label className="prompt-field prompt-field--large">
                            <span>Negative prompt</span>
                            <textarea
                                data-backend-input="negativePrompt"
                                placeholder="Describe what the result should avoid..."
                                value={negativePrompt}
                                onChange={event => setNegativePrompt(event.target.value)}
                            />
                        </label>
                    </div>
                    <div className="workflow-actions">
                        <button className="generate-button" type="button" onClick={handleGenerate} disabled={isGenerating || !referenceFile}>
                            {isGenerating ? 'Queueing…' : 'Generate and open Dashboard'}
                            <span aria-hidden="true">↗</span>
                        </button>
                        {generationError && <p className="workspace-error" role="alert">{generationError}</p>}
                    </div>
                </section>
            </div>
        </main>
    );
}

function WorkflowScreen({ backUrl, dashboardUrl, workflowUrl }: { backUrl: string; dashboardUrl: string; workflowUrl: string }) {
    const [product, setProduct] = useState<ApiProduct | null>(null);
    const [error, setError] = useState('');
    const [repositoryUrl, setRepositoryUrl] = useState('');
    const [setupStatus, setSetupStatus] = useState('');
    const [repositoryReady, setRepositoryReady] = useState(false);
    const [isCheckingSetup, setIsCheckingSetup] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const previewWorkspace = import.meta.env.DEV
            && new URLSearchParams(window.location.search).get('preview') === 'workspace';
        if (previewWorkspace) {
            setRepositoryReady(true);
            setIsCheckingSetup(false);
            return;
        }

        fetchProducts()
            .then(async products => {
                const anislot = products.find(item => item.name === 'AniSlot') || null;
                setProduct(anislot);
                if (!anislot) return;
                const setup = await fetchSetupStatus(anislot.id);
                setRepositoryReady(setup.configured);
                if (setup.configured) setSetupStatus('GitHub repository is ready.');
            })
            .catch((requestError: Error) => setError(requestError.message))
            .finally(() => setIsCheckingSetup(false));
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!product || !repositoryUrl.trim()) return;

        setIsSubmitting(true);
        setSetupStatus('Cloning repository...');

        try {
            const result = await startSetup(product.id, repositoryUrl.trim());
            setSetupStatus(`Repository is ready: ${result.localPath}`);
            setRepositoryReady(true);
        } catch (requestError) {
            setSetupStatus(requestError instanceof Error ? requestError.message : 'Setup failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (repositoryReady) return <Workspace backUrl={backUrl} dashboardUrl={dashboardUrl} workflowUrl={workflowUrl} />;

    return (
        <SetupCard
            backUrl={backUrl}
            product={product}
            error={error}
            repositoryUrl={repositoryUrl}
            setupStatus={setupStatus}
            isCheckingSetup={isCheckingSetup}
            isSubmitting={isSubmitting}
            onRepositoryChange={setRepositoryUrl}
            onSubmit={handleSubmit}
        />
    );
}

export default function AniSlot({
    backUrl,
    dashboardUrl = '/dashboard/',
    workflowUrl = '/anislot/core/',
    page = 'workflow',
}: {
    backUrl: string;
    dashboardUrl?: string;
    workflowUrl?: string;
    page?: 'dashboard' | 'workflow';
}) {
    if (page === 'dashboard') {
        return <Dashboard backUrl={backUrl} dashboardUrl={dashboardUrl} workflowUrl={workflowUrl} />;
    }
    return <WorkflowScreen backUrl={backUrl} dashboardUrl={dashboardUrl} workflowUrl={workflowUrl} />;
}
