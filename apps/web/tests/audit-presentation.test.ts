import type { AuditRecord } from '@seduc/contracts';
import { describe, expect, it } from 'vitest';

import { formatAuditDate, humanizeAudit } from '@/utils/audit-presentation';

const baseAudit: AuditRecord = {
  acao: 'CREATE',
  dadosAnteriores: null,
  dadosNovos: null,
  dataHora: '2026-10-08T18:20:00.000Z',
  entidade: 'ATRIBUICAO_MANUAL',
  id: 'audit-id',
  profissionalId: 'professional-id',
  registroId: 'record-id',
  unidadeId: 'unit-id',
  usuario: { id: 'user-id', login: 'joao', nome: 'Operador João' },
  usuarioId: 'user-id',
};

describe('apresentação humana da auditoria', () => {
  it('descreve atribuição usando os nomes disponíveis no payload sem modificá-lo', () => {
    const dadosNovos = {
      destino: { unidadeNome: 'EMEF Vila Nova' },
      profissional: { nomeCompleto: 'Ana Paula Martins' },
      sedeAnterior: { unidadeNome: 'EMEF Jardim das Flores' },
    };
    const summary = humanizeAudit({ ...baseAudit, dadosNovos });

    expect(summary.titulo).toBe('Atribuição manual realizada');
    expect(summary.descricao).toBe(
      'Ana Paula Martins teve a atribuição alterada de EMEF Jardim das Flores para EMEF Vila Nova.',
    );
    expect(summary.profissional).toBe('Ana Paula Martins');
    expect(summary.unidadeOrigem).toBe('EMEF Jardim das Flores');
    expect(summary.unidadeDestino).toBe('EMEF Vila Nova');
    expect(dadosNovos).toEqual({
      destino: { unidadeNome: 'EMEF Vila Nova' },
      profissional: { nomeCompleto: 'Ana Paula Martins' },
      sedeAnterior: { unidadeNome: 'EMEF Jardim das Flores' },
    });
  });

  it('usa um fallback administrativo quando não há dados suficientes', () => {
    const summary = humanizeAudit({ ...baseAudit, entidade: 'ENTIDADE_DESCONHECIDA' });

    expect(summary.descricao).toBe('Foi registrada uma alteração administrativa neste cadastro.');
    expect(summary.titulo).toBe('Alteração administrativa registrada');
  });

  it('formata data e hora em horário administrativo local', () => {
    expect(formatAuditDate(baseAudit.dataHora)).toBe('08/10/2026 às 15:20');
  });
});
