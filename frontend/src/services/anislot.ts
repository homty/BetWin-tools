export type AniSlotJob = {
    itemId: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'canceled' | string;
    imageName?: string;
    imageUrl?: string;
    error?: string;
};

function getCookie(name: string): string {
    const prefix = `${name}=`;
    return document.cookie
        .split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith(prefix))
        ?.slice(prefix.length) || '';
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = typeof data.error === 'string' ? data.error : 'AniSlot request failed.';
        throw new Error(message);
    }
    return data;
}

export async function generateAniSlot(values: {
    image: File;
    slotConceptImage?: File;
    slotConceptPrompt?: string;
    positivePrompt?: string;
    negativePrompt?: string;
    seed?: string;
    width?: string;
    runs?: number;
}): Promise<{ itemId: string; itemIds: string[] }> {
    const body = new FormData();
    body.append('image', values.image);
    if (values.slotConceptImage) body.append('slotConceptImage', values.slotConceptImage);
    if (values.slotConceptPrompt?.trim()) body.append('slotConceptPrompt', values.slotConceptPrompt.trim());
    if (values.positivePrompt?.trim()) body.append('positivePrompt', values.positivePrompt.trim());
    if (values.negativePrompt?.trim()) body.append('negativePrompt', values.negativePrompt.trim());
    if (values.seed?.trim()) body.append('seed', values.seed.trim());
    if (values.width?.trim()) body.append('width', values.width.trim());
    if (values.runs && values.runs > 1) body.append('runs', String(values.runs));

    const data = await readResponse(await fetch('/api/anislot/generate/', {
        method: 'POST',
        headers: {'X-CSRFToken': getCookie('csrftoken')},
        body,
    }));
    if (typeof data.itemId !== 'string' && typeof data.itemId !== 'number') {
        throw new Error('AniSlot did not return a queue item ID.');
    }
    const itemIds = Array.isArray(data.itemIds)
        ? data.itemIds.filter((id): id is string | number => typeof id === 'string' || typeof id === 'number').map(String)
        : [data.itemId].map(String);
    return {itemId: String(data.itemId), itemIds};
}

export async function getAniSlotJob(itemId: string): Promise<AniSlotJob> {
    return await readResponse(await fetch(`/api/anislot/jobs/${encodeURIComponent(itemId)}/`)) as AniSlotJob;
}
