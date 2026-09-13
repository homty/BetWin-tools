import { defineConfig } from 'vite';

export default defineConfig({
    base: '/static/frontend/',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
        outDir: '../static/frontend',
        emptyOutDir: true,
        lib: { entry: 'src/main.tsx', formats: ['es'], fileName: () => 'welcome.js', cssFileName: 'welcome' },
        rollupOptions: { output: { assetFileNames: '[name][extname]' } },
    },
});
