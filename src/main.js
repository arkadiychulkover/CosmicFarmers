import { mount } from 'svelte';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/600.css';
import '@fontsource/roboto/700.css';
import '@fontsource/advent-pro/600.css';
import '@fontsource/advent-pro/700.css';
import './style.css';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app'),
});

export default app;
