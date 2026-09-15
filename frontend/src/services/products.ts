export type ApiProduct = {
    id: number;
    name: string;
    description: string;
    githubUrl: string;
};

type ProductsResponse = { products: ApiProduct[] };

export type SetupResponse = {
    id: number;
    status: string;
    localPath: string;
};

export type SetupStatusResponse = {
    configured: boolean;
    status: string;
    localPath?: string;
};

function getCookie(name: string): string {
    const prefix = `${name}=`;
    return document.cookie
        .split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith(prefix))
        ?.slice(prefix.length) || '';
}

export async function fetchProducts(): Promise<ApiProduct[]> {
    const response = await fetch('/api/products/');
    const data = await response.json().catch(() => ({} as ProductsResponse));
    if (!response.ok || !Array.isArray(data.products)) {
        throw new Error('Could not load products.');
    }
    return data.products;
}

export async function startSetup(productId: number, repositoryUrl: string): Promise<SetupResponse> {
    const response = await fetch('/api/setup/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({
            productId,
            repositoryUrl,
        }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Setup failed.');
    }

    return data as SetupResponse;
}

export async function fetchSetupStatus(productId: number): Promise<SetupStatusResponse> {
    const response = await fetch(`/api/setup/status/?productId=${encodeURIComponent(productId)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not check setup status.');
    }
    return data as SetupStatusResponse;
}
