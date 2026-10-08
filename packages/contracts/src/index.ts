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

export const USER_PROFILES = ['ADMINISTRADOR', 'OPERADOR', 'DIRETOR', 'SECRETARIO'] as const;

export type UserProfile = (typeof USER_PROFILES)[number];

export interface AuthenticatedUnit {
  id: string;
  nome: string;
}

export interface AuthenticatedUser {
  email: string | null;
  id: string;
  login: string;
  nome: string;
  perfil: UserProfile;
  unidades: readonly AuthenticatedUnit[];
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface AuthResponse {
  user: AuthenticatedUser;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PhoneRecord {
  id: string;
  numero: string;
  tipo: string;
}

export interface LookupRecord {
  ativo?: boolean;
  id: string;
  nome: string;
}

export interface UnitRecord {
  ativo: boolean;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  codigoInep: string | null;
  complemento: string | null;
  endereco: string | null;
  id: string;
  nome: string;
  numero: string | null;
  observacoes: string | null;
  poloRegiao: string | null;
  telefones: PhoneRecord[];
  tipoUnidade: LookupRecord;
  tipoUnidadeId: string;
}

export interface ProfessionalPlacement {
  postoId: string;
  unidadeId: string;
  unidadeNome: string;
}

export interface ProfessionalExercise extends ProfessionalPlacement {
  id: string;
  substituiProfissional: WorkPositionProfessional | null;
  tipo: 'SEDE' | 'SUBSTITUICAO' | 'SEM_SEDE';
}

export interface ProfessionalPlacementHistory extends ProfessionalPlacement {
  dataFim: string | null;
  dataInicio: string;
  id: string;
  motivoFim: string | null;
}

export interface ProfessionalExerciseHistory extends ProfessionalExercise {
  dataFim: string | null;
  dataInicio: string;
  observacoes: string | null;
}

export interface ProfessionalAbsenceRecord {
  ativo: boolean;
  dataFim: string | null;
  dataInicio: string;
  id: string;
  observacoes: string | null;
  profissionalId: string;
  tipo: string;
}

export interface ProfessionalFunctionalSituation {
  descricao: string;
  tipo: 'AFASTADO' | 'EXERCICIO_EXTERNO' | 'PROPRIA_SEDE' | 'SEM_EXERCICIO';
}

export interface ProfessionalRelationshipsRecord {
  afastamentos: ProfessionalAbsenceRecord[];
  afastamentosAtivos: ProfessionalAbsenceRecord[];
  exerciciosAtuais: ProfessionalExerciseHistory[];
  historicoExercicios: ProfessionalExerciseHistory[];
  historicoSedes: ProfessionalPlacementHistory[];
  profissionalId: string;
  sedeAtual: ProfessionalPlacementHistory | null;
}

export interface ProfessionalRecord {
  ativo: boolean;
  bairro: string | null;
  cargoFuncao: LookupRecord & {
    ehProfessor: boolean;
    permiteMultiplosExercicios: boolean;
    usaPontuacao: boolean;
  };
  cargoFuncaoId: string;
  cep: string | null;
  cidade: string | null;
  complemento: string | null;
  cpf: string;
  dataDesligamento: string | null;
  dataEntradaPrefeitura: string;
  dataNascimento: string;
  email: string | null;
  endereco: string | null;
  exerciciosAtuais: ProfessionalExercise[];
  id: string;
  matricula: string;
  nomeCompleto: string;
  numero: string | null;
  numeroFilhos: number;
  observacoes: string | null;
  permuta: boolean;
  pontuacao: string;
  remocao: boolean;
  sedeAtual: ProfessionalPlacement | null;
  situacaoFuncional: ProfessionalFunctionalSituation;
  telefones: PhoneRecord[];
}

export interface UserRecord {
  ativo: boolean;
  email: string | null;
  id: string;
  login: string;
  nome: string;
  perfil: UserProfile;
  unidadeIds: string[];
  unidades: AuthenticatedUnit[];
}

export interface StaffingPlanRecord {
  anoLetivo: number;
  cargoFuncao: LookupRecord;
  cargoFuncaoId: string;
  id: string;
  observacoes: string | null;
  periodo: LookupRecord;
  periodoId: string;
  quantidade: number;
  quantidadePostosAtivos: number;
  segmentoEnsino: LookupRecord | null;
  segmentoEnsinoId: string | null;
  unidade: LookupRecord;
  unidadeId: string;
}

export interface WorkPositionProfessional {
  id: string;
  matricula: string;
  nomeCompleto: string;
}

export type WorkPositionAvailability =
  'DISPONIVEL_COM_SEDE' | 'DISPONIVEL_SEM_SEDE' | 'INDISPONIVEL' | 'INATIVO';

export type WorkPositionReleaseReason = 'AFASTAMENTO' | 'EXERCICIO_OUTRO_POSTO';

export type WorkPositionStructuralState = WorkPositionAvailability;

export interface WorkPositionExercise {
  id: string;
  profissional: WorkPositionProfessional;
  substituiProfissional: WorkPositionProfessional | null;
  tipo: 'SEDE' | 'SUBSTITUICAO' | 'SEM_SEDE';
}

export interface WorkPositionRecord {
  anoLetivo: number;
  ativo: boolean;
  cargoFuncao: LookupRecord;
  cargoFuncaoId: string;
  codigo: string;
  disponibilidade: WorkPositionAvailability;
  estadoEstrutural: WorkPositionStructuralState;
  exercicioAtual: WorkPositionExercise | null;
  id: string;
  motivosLiberacao: WorkPositionReleaseReason[];
  ocupanteAtual: WorkPositionProfessional | null;
  periodo: LookupRecord;
  periodoId: string;
  quadroNecessidadeId: string;
  titularAtual: WorkPositionProfessional | null;
  unidade: LookupRecord;
  unidadeId: string;
}

export interface ManualAssignmentConfiguration {
  habilitada: boolean;
}

export interface ManualAssignmentProfessional {
  afastado: boolean;
  ativo: boolean;
  cargoFuncao: LookupRecord;
  cargoFuncaoId: string;
  exerciciosAtuais: ProfessionalExerciseHistory[];
  id: string;
  matricula: string;
  nomeCompleto: string;
  sedeAtual: ProfessionalPlacementHistory | null;
}

export interface ManualAssignmentSimulation {
  destino: WorkPositionRecord;
  exerciciosEncerrados: ProfessionalExerciseHistory[];
  profissional: ManualAssignmentProfessional;
  sedeAnterior: ProfessionalPlacementHistory | null;
  tipoDestino: 'COM_SEDE' | 'SEM_SEDE';
}

export interface ManualAssignmentResult extends ManualAssignmentSimulation {
  confirmadoEm: string;
}

export interface ManualAdministrativeExercise {
  id: string;
  postoId: string;
  postoCodigo: string;
  tipo: 'SEDE' | 'SUBSTITUICAO' | 'SEM_SEDE';
  unidadeId: string;
  unidadeNome: string;
}

export interface ManualAdministrativePosition {
  postoId: string;
  postoCodigo: string;
  unidadeId: string;
  unidadeNome: string;
}

export interface ManualAdministrativeSeat extends ManualAdministrativePosition {
  lotacaoSedeId: string;
}

export interface ManualSeatRemovalSimulation {
  exercicioAtual: ManualAdministrativeExercise | null;
  ocupanteAtual: WorkPositionProfessional | null;
  profissional: WorkPositionProfessional;
  sedeAtual: ManualAdministrativeSeat;
}

export type ManualExerciseEndOutcome =
  | 'PERMANECE_AFASTADO'
  | 'PERMANECE_EM_OUTRO_EXERCICIO'
  | 'PERMANECE_SEM_SEDE'
  | 'RETORNA_A_PROPRIA_SEDE';

export interface ManualExerciseEndSimulation {
  exercicioAtual: ManualAdministrativeExercise;
  impedimento: string | null;
  podeConfirmar: boolean;
  postoOcupado: ManualAdministrativePosition;
  profissional: WorkPositionProfessional;
  sedeAtual: ManualAdministrativeSeat | null;
  situacaoPrevista: ManualExerciseEndOutcome;
}

export type EventType = 'REMOCAO' | 'PERMUTA' | 'LISTAO' | 'ATRIBUICAO';
export type EventStatus = 'RASCUNHO' | 'ATIVO' | 'ENCERRADO' | 'CANCELADO';

export interface EventRecord {
  ano: number;
  cargoFuncao: LookupRecord & { usaPontuacao: boolean };
  cargoFuncaoId: string;
  dataFim: string | null;
  dataInicio: string | null;
  id: string;
  iniciadoPorUsuarioId: string | null;
  nome: string;
  status: EventStatus;
  tipo: EventType;
}

export interface EventPreparationProfessional {
  cargo: string;
  dataEntradaPrefeitura: string;
  dataNascimento: string;
  elegivel: boolean;
  empatePendente: boolean;
  matricula: string;
  motivoInelegibilidade: string | null;
  nome: string;
  numeroFilhos: number;
  ordemPrevia: number | null;
  permuta: boolean;
  pontuacao: string | null;
  possuiSedeAtual: boolean;
  profissionalId: string;
  remocao: boolean;
  selecionado: boolean;
}

export interface EventQueuePreviewItem {
  dataEntrada: string;
  dataNascimento: string;
  empatePendente: boolean;
  nome: string;
  numeroFilhos: number;
  posicao: number | null;
  profissionalId: string;
  pontuacao: string | null;
}

export interface EventTieGroup {
  profissionalIds: string[];
}

export interface EventPreparationRecord {
  evento: EventRecord;
  gruposEmpate: EventTieGroup[];
  preview: EventQueuePreviewItem[];
  profissionais: EventPreparationProfessional[];
  selecionados: string[];
  totais: {
    cargo: number;
    elegiveis: number;
    empatesPendentes: number;
    selecionados: number;
  };
}

export type EventDestinationType = 'SEDE' | 'SEM_SEDE';

export interface EventOperationalLink {
  periodo: LookupRecord;
  periodoId: string;
  postoId: string;
  unidade: LookupRecord;
  unidadeId: string;
}

export interface EventOperationalExercise extends EventOperationalLink {
  id: string;
  substituiProfissional: { id: string; nome: string } | null;
  tipo: 'SEDE' | 'SUBSTITUICAO' | 'SEM_SEDE';
}

export interface EventOperationalSituation {
  exerciciosAtuais: EventOperationalExercise[];
  sedeAtual: EventOperationalLink | null;
}

export interface EventOperationalParticipant {
  cargo: string;
  dataEntradaSnapshot: string;
  dataNascimentoSnapshot: string;
  nome: string;
  numeroFilhosSnapshot: number;
  participanteId: string;
  pontuacaoSnapshot: string | null;
  posicao: number;
  profissionalId: string;
  status: 'AGUARDANDO' | 'ATENDIDO';
}

export interface EventOperationalMovement {
  dataHora: string;
  id: string;
  origem: EventOperationalLink | null;
  periodo: string;
  postoDestinoId: string;
  postoOrigemId: string | null;
  profissional: string;
  tipoDestino: EventDestinationType;
  unidadeDestino: string;
}

export type EventPeriodRuleStatus =
  | {
      code: null;
      message: null;
      mode: 'FIXED';
      periodoId: string;
    }
  | {
      code: null;
      message: string;
      mode: 'ANY';
      periodoId: null;
    }
  | {
      code: 'EVENT_PERIOD_RULE_REQUIRED';
      message: string;
      mode: 'BLOCKED';
      periodoId: null;
    };

export interface EventCentralRecord {
  evento: EventRecord;
  fila: EventOperationalParticipant[];
  participanteAtual: EventOperationalParticipant | null;
  proximos: EventOperationalParticipant[];
  regraPeriodo: EventPeriodRuleStatus | null;
  situacaoAtual: EventOperationalSituation | null;
  totais: {
    aguardando: number;
    atendidos: number;
    podeEncerrar: boolean;
    total: number;
    vagasDisponiveis: number;
  };
  ultimasMovimentacoes: EventOperationalMovement[];
  vagasDisponiveis: WorkPositionRecord[];
}

export interface EventChoiceSimulation {
  antes: {
    exerciciosAtuais: EventOperationalExercise[];
    profissional: string;
    sedeOficial: EventOperationalLink | null;
  };
  depois: {
    exercicioNovo: (EventOperationalLink & { tipo: 'SUBSTITUICAO' | 'SEM_SEDE' }) | null;
    sedeOficial: EventOperationalLink | null;
    titularidadePreservada: boolean;
    vinculoEncerrado: EventOperationalLink | null;
  };
  destino: EventOperationalLink & {
    tipo: EventDestinationType;
    titular: { id: string; nome: string } | null;
  };
  novasVagasGeradas: Array<EventOperationalLink & { tipo: EventDestinationType }>;
  participanteEsperadoId: string;
}

export interface EventChoiceResult {
  atendido: EventOperationalParticipant;
  central: EventCentralRecord;
  movimentacao: EventOperationalMovement;
}

export interface EventExchangeParticipant extends EventOperationalParticipant {
  sedeAtual: EventOperationalLink | null;
}

export interface EventExchangeCentralRecord {
  candidatos: EventExchangeParticipant[];
  evento: EventRecord;
  fila: EventOperationalParticipant[];
  participanteAtual: EventExchangeParticipant | null;
  proximos: EventOperationalParticipant[];
  totais: {
    aguardando: number;
    atendidos: number;
    total: number;
  };
  ultimasPermutas: EventExchangeMovement[];
}

export interface EventExchangeSide {
  depois: EventOperationalLink;
  nome: string;
  participanteId: string;
  profissionalId: string;
  sedeAtual: EventOperationalLink;
}

export interface EventExchangeSimulation {
  compatibilidade: 'COMPATIVEL';
  consequenciaQuadro: string;
  impedimentos: string[];
  participanteAtualEsperadoId: string;
  postoOrigemAtualEsperadoId: string;
  postoOrigemSegundoEsperadoId: string;
  profissionalA: EventExchangeSide;
  profissionalB: EventExchangeSide;
}

export interface EventExchangeMovementItem {
  destino: EventOperationalLink;
  origem: EventOperationalLink;
  profissional: string;
  profissionalId: string;
}

export interface EventExchangeMovement {
  dataHora: string;
  id: string;
  itens: EventExchangeMovementItem[];
}

export interface EventExchangeResult {
  central: EventExchangeCentralRecord;
  movimentacao: EventExchangeMovement;
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditRecord {
  acao: AuditAction;
  dadosAnteriores: unknown | null;
  dadosNovos: unknown | null;
  dataHora: string;
  entidade: string;
  id: string;
  profissionalId: string | null;
  registroId: string;
  unidadeId: string | null;
  usuario: { id: string; nome: string; login: string };
  usuarioId: string;
}

export interface PublicEventChoice {
  dataHora: string;
  periodo: string;
  profissional: string;
  tipoDestino: EventDestinationType;
  unidadeDestino: string;
}

export interface PublicEventDisplay {
  evento: {
    ano: number;
    nome: string;
    status: 'ATIVO' | 'ENCERRADO';
    tipo: 'REMOCAO' | 'LISTAO' | 'ATRIBUICAO';
  };
  participanteAtual: { nome: string; posicao: number } | null;
  proximos: Array<{ nome: string; posicao: number }>;
  ultimasEscolhas: PublicEventChoice[];
  vagas: Array<{
    periodo: string;
    quantidade: number;
    tipo: EventDestinationType;
    unidade: string;
  }>;
}
