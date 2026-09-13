import { track } from './loading';

type PipelinePayload = Record<string, unknown>;
type PipelineResponse = Record<string, unknown>;

function getCookie(name: string): string {
    const prefix = `${name}=`;
    return document.cookie
        .split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith(prefix))
        ?.slice(prefix.length) || '';
}

export async function sendPipelineRequest(payload: PipelinePayload): Promise<PipelineResponse> {
    return track(fetch('/api/pipeline/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify(payload),
    }).then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = typeof data.error === 'string' ? data.error : 'Pipeline request failed.';
            throw new Error(message);
        }
        return data as PipelineResponse;
    }));
}
