import type {
  ManualAssignmentConfiguration,
  ManualAssignmentProfessional,
  ManualAssignmentResult,
  ManualAssignmentSimulation,
  PaginatedResponse,
  WorkPositionRecord,
} from '@seduc/contracts';

import { queryString, request } from './registry.service';

export interface ManualAssignmentInput {
  postoTrabalhoId: string;
  profissionalId: string;
  tipoDestino: 'COM_SEDE' | 'SEM_SEDE';
}

export const manualAssignmentApi = {
  configuration() {
    return request<ManualAssignmentConfiguration>('/atribuicao-manual/configuracao');
  },
  confirm(input: ManualAssignmentInput) {
    return request<ManualAssignmentResult>('/atribuicao-manual/confirmar', {
      body: JSON.stringify(input),
      method: 'POST',
    });
  },
  listPositions(profissionalId: string) {
    return request<WorkPositionRecord[]>(
      `/atribuicao-manual/postos${queryString({ profissionalId })}`,
    );
  },
  listProfessionals(busca: string, page: number) {
    return request<PaginatedResponse<ManualAssignmentProfessional>>(
      `/atribuicao-manual/profissionais${queryString({ busca, page, pageSize: 20 })}`,
    );
  },
  simulate(input: ManualAssignmentInput) {
    return request<ManualAssignmentSimulation>('/atribuicao-manual/simular', {
      body: JSON.stringify(input),
      method: 'POST',
    });
  },
  updateConfiguration(habilitada: boolean) {
    return request<ManualAssignmentConfiguration>('/atribuicao-manual/configuracao', {
      body: JSON.stringify({ habilitada }),
      method: 'PATCH',
    });
  },
};
