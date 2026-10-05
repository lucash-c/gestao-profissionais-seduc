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
  tipo: 'SEDE' | 'SUBSTITUICAO' | 'SEM_SEDE';
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

export type WorkPositionStructuralState = 'DISPONIVEL_COM_SEDE' | 'INATIVO' | 'OCUPADO_COM_SEDE';

export interface WorkPositionRecord {
  anoLetivo: number;
  ativo: boolean;
  cargoFuncao: LookupRecord;
  cargoFuncaoId: string;
  codigo: string | null;
  estadoEstrutural: WorkPositionStructuralState;
  id: string;
  ocupanteAtual: WorkPositionProfessional | null;
  periodo: LookupRecord;
  periodoId: string;
  quadroNecessidadeId: string;
  titularAtual: WorkPositionProfessional | null;
  unidade: LookupRecord;
  unidadeId: string;
}
