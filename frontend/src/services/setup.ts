type SetupResponse = {
    status?: string;
    githubUrl?: string;
    error?: string;
};

export type SetupStatus = {
    configured: boolean;
    status: string;
    githubUrl?: string;
};

function csrfToken(): string {
    const cookie = document.cookie
        .split('; ')
        .find(item => item.startsWith('csrftoken='));
    return cookie ? decodeURIComponent(cookie.slice('csrftoken='.length)) : '';
}

export async function setupRepository(productId: number, repositoryUrl: string): Promise<void> {
    const response = await fetch('/api/setup/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken(),
        },
        body: JSON.stringify({ productId, repositoryUrl }),
    });
    const data = await response.json().catch(() => ({} as SetupResponse)) as SetupResponse;

    if (!response.ok || data.status !== 'ready') {
        throw new Error(data.error || `Repository setup failed with HTTP ${response.status}.`);
    }
}

export async function fetchSetupStatus(productId: number): Promise<SetupStatus> {
    const response = await fetch(`/api/setup/status/?productId=${encodeURIComponent(productId)}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
    });
    const data = await response.json().catch(() => ({} as SetupStatus & { error?: string })) as SetupStatus & { error?: string };

    if (!response.ok || typeof data.configured !== 'boolean') {
        throw new Error(data.error || `Could not check repository setup (HTTP ${response.status}).`);
    }

    return data;
}
