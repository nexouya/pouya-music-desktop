import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { apiUrl, initApiBase, isDesktop } from './src/lib/api';

/** Rewrite relative API/stream URLs to the Rust core HTTP base (no-op in pure web). */
function installApiFetchBridge() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return originalFetch(apiUrl(input), init);
    }
    if (input instanceof Request) {
      const url = apiUrl(input.url);
      if (url !== input.url) {
        return originalFetch(new Request(url, input), init);
      }
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof fetch;

  // AudioLab (and similar) use XHR for upload progress — rewrite those URLs too.
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    const resolved = typeof url === 'string' ? apiUrl(url) : url;
    return (originalOpen as (...args: unknown[]) => void).call(
      this,
      method,
      resolved,
      ...rest,
    );
  } as typeof XMLHttpRequest.prototype.open;
}

async function boot() {
  await initApiBase();
  if (isDesktop()) {
    installApiFetchBridge();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
