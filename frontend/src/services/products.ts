export type ApiProduct = {
    id: number;
    name: string;
    description: string;
    githubUrl: string;
};

type ProductsResponse = { products: ApiProduct[] };

export async function fetchProducts(): Promise<ApiProduct[]> {
    const response = await fetch('/api/products/');
    const data = await response.json().catch(() => ({} as ProductsResponse));
    if (!response.ok || !Array.isArray(data.products)) {
        throw new Error('Could not load products.');
    }
    return data.products;
}
