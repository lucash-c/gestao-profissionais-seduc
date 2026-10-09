import type { AuditAction, AuditRecord } from '@seduc/contracts';

type JsonRecord = Record<string, unknown>;

export interface AuditHumanSummary {
  descricao: string;
  evento: string | null;
  profissional: string | null;
  titulo: string;
  unidadeDestino: string | null;
  unidadeOrigem: string | null;
}

const entityLabels: Record<string, string> = {
  AFASTAMENTO_PROFISSIONAL: 'Afastamento profissional',
  ATRIBUICAO_MANUAL: 'Atribuição manual',
  EVENTO: 'Evento',
  EVENTO_PREPARACAO: 'Preparação do evento',
  POSTO_TRABALHO: 'Posto de trabalho',
  PROFISSIONAL: 'Cadastro de profissional',
  PROFISSIONAL_PONTUACAO: 'Pontuação do profissional',
  PROFISSIONAL_TELEFONE: 'Telefone do profissional',
  QUADRO_NECESSIDADE: 'Quadro de necessidade',
  UNIDADE: 'Cadastro da unidade',
  UNIDADE_TELEFONE: 'Telefone da unidade',
  USUARIO: 'Cadastro de usuário',
  USUARIO_CREDENCIAL: 'Credencial de usuário',
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function valueAt(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => asRecord(current)?.[key], value);
}

function firstText(values: unknown[], paths: string[]): string | null {
  for (const value of values) {
    for (const path of paths) {
      const found = text(valueAt(value, path));
      if (found) return found;
    }
  }
  return null;
}

function actionLabel(action: AuditAction): string {
  return { CREATE: 'registrada', DELETE: 'removida', UPDATE: 'atualizada' }[action];
}

function actionTitle(action: AuditAction): string {
  return { CREATE: 'realizado', DELETE: 'removido', UPDATE: 'atualizado' }[action];
}

function masculineAction(action: AuditAction): string {
  return { CREATE: 'criado', DELETE: 'removido', UPDATE: 'atualizado' }[action];
}

function entityLabel(entity: string): string {
  return entityLabels[entity] ?? 'Alteração administrativa';
}

export function formatAuditDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })
    .format(date)
    .replace(',', ' às');
}

export function humanizeAudit(record: AuditRecord): AuditHumanSummary {
  const values = [record.dadosNovos, record.dadosAnteriores];
  const professional = firstText(values, [
    'profissional.nomeCompleto',
    'nomeCompleto',
    'profissional.nome',
    'profissional',
  ]);
  const event = firstText(values, ['evento.nome', 'nomeEvento']);
  const origin = firstText(values, [
    'sedeAnterior.unidadeNome',
    'origem.unidadeNome',
    'origem.unidade',
    'unidadeOrigem',
  ]);
  const destination = firstText(values, [
    'destino.unidadeNome',
    'unidadeDestino',
    'unidadeNome',
    'unidade.nome',
  ]);
  const namedEvent = record.entidade === 'EVENTO' ? firstText(values, ['nome']) : event;
  const subject =
    record.entidade === 'EVENTO'
      ? namedEvent
      : record.entidade === 'UNIDADE'
        ? firstText(values, ['nome'])
        : record.entidade === 'POSTO_TRABALHO'
          ? firstText(values, ['codigo'])
          : professional;
  const label = entityLabel(record.entidade);

  if (record.entidade === 'ATRIBUICAO_MANUAL' && professional && destination) {
    const transfer = origin
      ? `${professional} teve a atribuição alterada de ${origin} para ${destination}.`
      : `${professional} recebeu atribuição em ${destination}.`;
    return {
      descricao: transfer,
      evento: namedEvent,
      profissional: professional,
      titulo: 'Atribuição manual realizada',
      unidadeDestino: destination,
      unidadeOrigem: origin,
    };
  }

  if (subject) {
    const description =
      record.entidade === 'PROFISSIONAL'
        ? `O cadastro de ${subject} foi ${masculineAction(record.acao)}.`
        : record.entidade === 'EVENTO'
          ? `O evento ${subject} foi ${masculineAction(record.acao)}.`
          : record.entidade === 'UNIDADE'
            ? `A unidade ${subject} foi ${actionLabel(record.acao)}.`
            : record.entidade === 'POSTO_TRABALHO'
              ? `O posto ${subject} foi ${masculineAction(record.acao)}.`
              : `${subject} teve ${label.toLocaleLowerCase('pt-BR')} ${actionLabel(record.acao)}.`;
    return {
      descricao: description,
      evento: namedEvent,
      profissional: professional,
      titulo: `${label} ${actionTitle(record.acao)}`,
      unidadeDestino: destination,
      unidadeOrigem: origin,
    };
  }

  if (entityLabels[record.entidade]) {
    return {
      descricao: `${label} ${actionLabel(record.acao)}.`,
      evento: namedEvent,
      profissional: professional,
      titulo: `${label} ${actionTitle(record.acao)}`,
      unidadeDestino: destination,
      unidadeOrigem: origin,
    };
  }

  return {
    descricao: 'Foi registrada uma alteração administrativa neste cadastro.',
    evento: namedEvent,
    profissional: professional,
    titulo: 'Alteração administrativa registrada',
    unidadeDestino: destination,
    unidadeOrigem: origin,
  };
}
