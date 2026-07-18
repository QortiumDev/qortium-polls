/// <reference types="vite/client" />

import type { QdnRequest } from './qdnRequest';

declare global {
  const __APP_VERSION__: string;

  interface Window {
    _qdnBase?: unknown;
    _qdnIdentifier?: unknown;
    _qdnName?: unknown;
    _qdnPath?: unknown;
    _qdnService?: unknown;
    qdnRequest?: <T = unknown>(request: QdnRequest) => Promise<T>;
  }
}
