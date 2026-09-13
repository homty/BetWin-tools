type Listener = () => void;
const listeners = new Set<Listener>();
let manual = false;
let tasks = 0;
const preview = new URLSearchParams(location.search).get('waiting') === '1';
export const isLoading = () => preview || manual || tasks > 0;
const notify = () => listeners.forEach(listener => listener());
export const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

export const setLoading = (value: boolean) => {
    manual = value;
    notify();
};

export async function track<T>(promise: Promise<T>): Promise<T> {
    tasks++;
    notify();
    try { return await promise; }
    finally { tasks--; notify(); }
}

export const loading = {
    setLoading,
    track,
};
declare global { interface Window { betwinIntro: typeof loading; } }
window.betwinIntro = loading;

