import type {
  LookupRecord,
  PaginatedResponse,
  ProfessionalRecord,
  ProfessionalAbsenceRecord,
  ProfessionalRelationshipsRecord,
  StaffingPlanRecord,
  UnitRecord,
  UserRecord,
  WorkPositionRecord,
} from '@seduc/contracts';

import type { ValidationIssue } from './form-errors';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class RegistryHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
    this.name = 'RegistryHttpError';
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
      issues?: unknown;
      message?: unknown;
    } | null;
    throw new RegistryHttpError(
      response.status,
      typeof body?.error === 'string' ? body.error : 'REQUEST_FAILED',
      typeof body?.message === 'string' ? body.message : 'Não foi possível concluir a solicitação.',
      Array.isArray(body?.issues) ? (body.issues as ValidationIssue[]) : [],
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export function queryString(input: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export interface UnitFilters {
  ativo?: boolean;
  nome?: string;
  page: number;
  pageSize: number;
  tipoUnidadeId?: string;
}

export interface ProfessionalFilters {
  ativo?: boolean;
  cargoFuncaoId?: string;
  matricula?: string;
  nome?: string;
  page: number;
  pageSize: number;
  permuta?: boolean;
  remocao?: boolean;
  unidadeId?: string;
  usaPontuacao?: boolean;
}

export interface UserFilters {
  ativo?: boolean;
  nome?: string;
  page: number;
  pageSize: number;
  perfil?: string;
}

export interface StaffingPlanFilters {
  anoLetivo?: number;
  cargoFuncaoId?: string;
  page: number;
  pageSize: number;
  periodoId?: string;
  segmentoEnsinoId?: string;
  unidadeId?: string;
}

export interface WorkPositionFilters {
  anoLetivo?: number;
  ativo?: boolean;
  cargoFuncaoId?: string;
  page: number;
  pageSize: number;
  periodoId?: string;
  unidadeId?: string;
}

export const registryApi = {
  addProfessionalPhone(id: string, body: unknown) {
    return request<ProfessionalRecord>(`/profissionais/${id}/telefones`, {
      body: JSON.stringify(body),
      method: 'POST',
    });
  },
  addUnitPhone(id: string, body: unknown) {
    return request<UnitRecord>(`/unidades/${id}/telefones`, {
      body: JSON.stringify(body),
      method: 'POST',
    });
  },
  createProfessional(body: unknown) {
    return request<ProfessionalRecord>('/profissionais', {
      body: JSON.stringify(body),
      method: 'POST',
    });
  },
  createProfessionalAbsence(id: string, body: unknown) {
    return request<ProfessionalAbsenceRecord>(`/profissionais/${id}/afastamentos`, {
      body: JSON.stringify(body),
      method: 'POST',
    });
  },
  createUnit(body: unknown) {
    return request<UnitRecord>('/unidades', { body: JSON.stringify(body), method: 'POST' });
  },
  createUser(body: unknown) {
    return request<UserRecord>('/usuarios', { body: JSON.stringify(body), method: 'POST' });
  },
  deleteProfessional(id: string, senhaAtual: string) {
    return request<void>(`/profissionais/${id}`, {
      body: JSON.stringify({ senhaAtual }),
      method: 'DELETE',
    });
  },
  deleteStaffingPlan(id: string, senhaAtual: string) {
    return request<void>(`/quadros/${id}`, {
      body: JSON.stringify({ senhaAtual }),
      method: 'DELETE',
    });
  },
  deleteUnit(id: string, senhaAtual: string) {
    return request<void>(`/unidades/${id}`, {
      body: JSON.stringify({ senhaAtual }),
      method: 'DELETE',
    });
  },
  deleteUser(id: string, senhaAtual: string) {
    return request<void>(`/usuarios/${id}`, {
      body: JSON.stringify({ senhaAtual }),
      method: 'DELETE',
    });
  },
  deleteWorkPosition(id: string, senhaAtual: string) {
    return request<void>(`/postos/${id}`, {
      body: JSON.stringify({ senhaAtual }),
      method: 'DELETE',
    });
  },
  deleteProfessionalPhone(id: string, phoneId: string) {
    return request<void>(`/profissionais/${id}/telefones/${phoneId}`, { method: 'DELETE' });
  },
  deleteUnitPhone(id: string, phoneId: string) {
    return request<void>(`/unidades/${id}/telefones/${phoneId}`, { method: 'DELETE' });
  },
  listCargos() {
    return request<LookupRecord[]>('/dominios/cargos');
  },
  listPeriods() {
    return request<LookupRecord[]>('/dominios/periodos');
  },
  listProfessionals(filters: ProfessionalFilters) {
    return request<PaginatedResponse<ProfessionalRecord>>(`/profissionais${queryString(filters)}`);
  },
  getProfessionalRelationships(id: string) {
    return request<ProfessionalRelationshipsRecord>(`/profissionais/${id}/vinculos`);
  },
  endProfessionalAbsence(id: string, absenceId: string, dataFim: string) {
    return request<ProfessionalAbsenceRecord>(
      `/profissionais/${id}/afastamentos/${absenceId}/encerrar`,
      { body: JSON.stringify({ dataFim }), method: 'PATCH' },
    );
  },
  listSegments() {
    return request<LookupRecord[]>('/dominios/segmentos');
  },
  listStaffingPlans(filters: StaffingPlanFilters) {
    return request<PaginatedResponse<StaffingPlanRecord>>(`/quadros${queryString(filters)}`);
  },
  listTiposUnidade() {
    return request<LookupRecord[]>('/dominios/tipos-unidade');
  },
  listUnits(filters: UnitFilters) {
    return request<PaginatedResponse<UnitRecord>>(`/unidades${queryString(filters)}`);
  },
  listUnitOptions() {
    return request<LookupRecord[]>('/dominios/unidades');
  },
  listUsers(filters: UserFilters) {
    return request<PaginatedResponse<UserRecord>>(`/usuarios${queryString(filters)}`);
  },
  listWorkPositions(filters: WorkPositionFilters) {
    return request<PaginatedResponse<WorkPositionRecord>>(`/postos${queryString(filters)}`);
  },
  resetPassword(id: string, senha: string) {
    return request<void>(`/usuarios/${id}/senha`, {
      body: JSON.stringify({ senha }),
      method: 'PATCH',
    });
  },
  updateProfessional(id: string, body: unknown) {
    return request<ProfessionalRecord>(`/profissionais/${id}`, {
      body: JSON.stringify(body),
      method: 'PATCH',
    });
  },
  createStaffingPlan(body: unknown) {
    return request<StaffingPlanRecord>('/quadros', {
      body: JSON.stringify(body),
      method: 'POST',
    });
  },
  updateStaffingPlan(id: string, body: unknown) {
    return request<StaffingPlanRecord>(`/quadros/${id}`, {
      body: JSON.stringify(body),
      method: 'PATCH',
    });
  },
  updateScore(id: string, pontuacao: number) {
    return request<ProfessionalRecord>(`/profissionais/${id}/pontuacao`, {
      body: JSON.stringify({ pontuacao }),
      method: 'PATCH',
    });
  },
  updateProfessionalPhone(id: string, phoneId: string, body: unknown) {
    return request<ProfessionalRecord>(`/profissionais/${id}/telefones/${phoneId}`, {
      body: JSON.stringify(body),
      method: 'PATCH',
    });
  },
  updateUnit(id: string, body: unknown) {
    return request<UnitRecord>(`/unidades/${id}`, { body: JSON.stringify(body), method: 'PATCH' });
  },
  updateUnitPhone(id: string, phoneId: string, body: unknown) {
    return request<UnitRecord>(`/unidades/${id}/telefones/${phoneId}`, {
      body: JSON.stringify(body),
      method: 'PATCH',
    });
  },
  updateWorkPositionStatus(id: string, ativo: boolean) {
    return request<WorkPositionRecord>(`/postos/${id}/status`, {
      body: JSON.stringify({ ativo }),
      method: 'PATCH',
    });
  },
  updateUser(id: string, body: unknown) {
    return request<UserRecord>(`/usuarios/${id}`, { body: JSON.stringify(body), method: 'PATCH' });
  },
};
