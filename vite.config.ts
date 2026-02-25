import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            input: {
                main: 'index.html',
                game: 'stellar_conquest.html',
            },
        },
    },
});
