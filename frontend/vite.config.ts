import { defineConfig } from 'vite';

export default defineConfig({
    base: '/static/frontend/',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
        outDir: '../backend/static/frontend',
        emptyOutDir: true,
        lib: { entry: 'src/app/main.tsx', formats: ['es'], fileName: () => 'welcome.js', cssFileName: 'welcome' },
        rollupOptions: { output: { assetFileNames: '[name][extname]' } },
    },
});
