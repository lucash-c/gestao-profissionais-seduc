import type {
  ManualAssignmentConfiguration,
  ManualAssignmentProfessional,
  ManualAssignmentResult,
  ManualAssignmentSimulation,
  ManualExerciseEndSimulation,
  ManualSeatRemovalSimulation,
  PaginatedResponse,
  WorkPositionRecord,
} from '@seduc/contracts';

import { queryString, request } from './registry.service';

export interface ManualAssignmentInput {
  postoTrabalhoId: string;
  profissionalId: string;
  tipoDestino: 'COM_SEDE' | 'SEM_SEDE';
}

export interface ManualExerciseEndInput {
  exercicioId: string;
  profissionalId: string;
}

export interface ManualSeatRemovalInput {
  lotacaoSedeId: string;
  profissionalId: string;
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
  confirmExerciseEnd(input: ManualExerciseEndInput) {
    return request<void>('/atribuicao-manual/encerrar-exercicio/confirmar', {
      body: JSON.stringify(input),
      method: 'POST',
    });
  },
  confirmSeatRemoval(input: ManualSeatRemovalInput) {
    return request<void>('/atribuicao-manual/retirar-sede/confirmar', {
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
  simulateExerciseEnd(input: ManualExerciseEndInput) {
    return request<ManualExerciseEndSimulation>('/atribuicao-manual/encerrar-exercicio/simular', {
      body: JSON.stringify(input),
      method: 'POST',
    });
  },
  simulateSeatRemoval(input: ManualSeatRemovalInput) {
    return request<ManualSeatRemovalSimulation>('/atribuicao-manual/retirar-sede/simular', {
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
