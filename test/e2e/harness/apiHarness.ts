export interface ScanRequest {
  dir?: string;
  focus?: string;
  platform?: 'web' | 'mobile' | 'desktop' | 'all';
  include?: string[];
  exclude?: string[];
}

export interface ComponentMetadata {
  name: string;
  filePath: string;
  relativePath: string;
  platform: 'web' | 'mobile' | 'desktop';
  rootElement?: string;
  elementCount?: number;
}

export interface ScanResponse {
  success?: boolean;
  components: ComponentMetadata[];
  totalCount: number;
  exceedsThreshold: boolean;
  folderBreakdown: Record<string, number>;
  suggestedFocus?: string[];
}

export interface ComponentGetRequest {
  filePath: string;
}

export interface ElementDetail {
  id: string;
  tag: string;
  type: 'button' | 'header' | 'input' | 'container' | 'card' | 'text' | 'other';
  classes: string;
  text?: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
}

export interface ComponentGetResponse {
  success?: boolean;
  filePath: string;
  code: string;
  elements: ElementDetail[];
}

export interface ComponentModifyRequest {
  filePath: string;
  elementId?: string;
  prompt: string;
}

export interface ComponentModifyResponse {
  success: boolean;
  filePath: string;
  modifiedCode: string;
  backupPath: string;
  appliedChanges: string[];
}

export interface ComponentRollbackRequest {
  filePath: string;
  backupPath?: string;
}

export interface ComponentRollbackResponse {
  success: boolean;
  restoredFrom: string;
  currentCode: string;
}

export interface HealthResponse {
  status: string;
  timestamp?: string;
  service?: string;
  version?: string;
}

export interface HttpResponse<T = any> {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  data: T;
  rawText: string;
}

export class ApiHarnessClient {
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(baseUrl: string, defaultTimeout: number = 10000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeout = defaultTimeout;
  }

  private async request<T = any>(
    path: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<HttpResponse<T>> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
      signal: AbortSignal.timeout(options.timeout ?? this.defaultTimeout),
    };

    if (options.body !== undefined) {
      fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const res = await fetch(url, fetchOptions);
    const rawText = await res.text();
    let data: any = null;

    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      responseHeaders[key.toLowerCase()] = val;
    });

    return {
      status: res.status,
      ok: res.ok,
      headers: responseHeaders,
      data,
      rawText,
    };
  }

  /**
   * GET /api/health
   */
  async getHealth(): Promise<HttpResponse<HealthResponse>> {
    return this.request<HealthResponse>('/api/health');
  }

  /**
   * GET / (SPA index HTML)
   */
  async getSpaRoot(): Promise<HttpResponse<string>> {
    return this.request<string>('/', {
      headers: { Accept: 'text/html' },
    });
  }

  /**
   * POST /api/project/scan
   */
  async scan(req: ScanRequest = {}): Promise<HttpResponse<ScanResponse>> {
    return this.request<ScanResponse>('/api/project/scan', {
      method: 'POST',
      body: req,
    });
  }

  /**
   * POST /api/component/get
   */
  async getComponent(req: ComponentGetRequest): Promise<HttpResponse<ComponentGetResponse>> {
    return this.request<ComponentGetResponse>('/api/component/get', {
      method: 'POST',
      body: req,
    });
  }

  /**
   * POST /api/component/modify
   */
  async modifyComponent(req: ComponentModifyRequest): Promise<HttpResponse<ComponentModifyResponse>> {
    return this.request<ComponentModifyResponse>('/api/component/modify', {
      method: 'POST',
      body: req,
    });
  }

  /**
   * POST /api/component/rollback
   */
  async rollbackComponent(req: ComponentRollbackRequest): Promise<HttpResponse<ComponentRollbackResponse>> {
    return this.request<ComponentRollbackResponse>('/api/component/rollback', {
      method: 'POST',
      body: req,
    });
  }
}

/**
 * Creates an ApiHarnessClient bound to a server URL
 */
export function createApiClient(baseUrl: string): ApiHarnessClient {
  return new ApiHarnessClient(baseUrl);
}
