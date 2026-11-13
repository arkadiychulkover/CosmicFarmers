import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
    plugins: [svelte()],
    // wasm-файлы onnxruntime-web не должны прогоняться через pre-bundling
    optimizeDeps: { exclude: ['onnxruntime-web'] },
});
