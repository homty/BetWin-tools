import { track } from './loading';

export type StartupResult = {
    pipelineConfigured: boolean;
};

type HealthResponse = {
    status?: string;
    pipelineConfigured?: boolean;
};

async function checkApiGateway(): Promise<HealthResponse> {
    const response = await fetch('/api/health/', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
        throw new Error(`API gateway health check failed with HTTP ${response.status}.`);
    }

    return response.json() as Promise<HealthResponse>;
}

async function preloadPage(url: string): Promise<void> {
    const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'text/html' },
    });

    if (!response.ok) {
        throw new Error(`Product page preload failed with HTTP ${response.status}.`);
    }

    // Consume the response so the request represents the complete page download.
    await response.text();
}

export async function prepareApplication(dashboardUrl: string): Promise<StartupResult> {
    return track((async () => {
        const [health] = await Promise.all([
            checkApiGateway(),
            preloadPage(dashboardUrl),
        ]);

        return {
            pipelineConfigured: health.pipelineConfigured === true,
        };
    })());
}
