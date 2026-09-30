export interface LiveHealthResponse {
  service: 'seduc-api';
  status: 'ok';
  timestamp: string;
}

export interface ReadyHealthResponse {
  checks: {
    database: 'up';
  };
  service: 'seduc-api';
  status: 'ready';
  timestamp: string;
}

export interface UnreadyHealthResponse {
  checks: {
    database: 'down';
  };
  service: 'seduc-api';
  status: 'unavailable';
  timestamp: string;
}

export type HealthResponse = ReadyHealthResponse | UnreadyHealthResponse;
