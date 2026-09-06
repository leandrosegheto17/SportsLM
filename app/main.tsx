import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design-system/tokens.css';
import { App } from './App';

const elementoRaiz = document.getElementById('raiz');

if (!elementoRaiz) {
  throw new Error('SportsLM: elemento #raiz não encontrado em app/index.html.');
}

createRoot(elementoRaiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
