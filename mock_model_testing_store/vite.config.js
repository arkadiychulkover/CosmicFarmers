import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Код модуля и .onnx копирует scripts/sync.mjs перед сборкой: песочница самодостаточна.
export default defineConfig({ plugins: [svelte()] });
