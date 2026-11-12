import { mount } from 'svelte';
import '@fontsource-variable/inter';
import './style.css';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app'),
});

export default app;
