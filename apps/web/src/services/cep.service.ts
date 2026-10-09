/**
 * Consulta endereços no ViaCEP. A integração envia somente os oito dígitos do CEP
 * e mantém um cache em memória durante a sessão do navegador.
 */
const VIA_CEP_ENDPOINT = 'https://viacep.com.br/ws';
const CEP_TIMEOUT_MS = 5_000;

export interface ViaCepResponse {
  bairro: string;
  cep: string;
  complemento: string;
  erro?: boolean;
  localidade: string;
  logradouro: string;
  uf: string;
}

export interface ViaCepAddress {
  bairro: string;
  cep: string;
  complemento: string;
  cidade: string;
  endereco: string;
  uf: string;
}

export interface AddressFormFields {
  bairro: string;
  cidade: string;
  complemento: string;
  endereco: string;
  uf?: string;
}

export type CepLookupFailureReason = 'INVALID' | 'NOT_FOUND' | 'UNAVAILABLE';

export class CepLookupError extends Error {
  constructor(public readonly reason: CepLookupFailureReason) {
    super(reason);
    this.name = 'CepLookupError';
  }
}

const cache = new Map<string, ViaCepAddress>();

export function normalizeCep(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCep(value: string): boolean {
  return /^\d{8}$/.test(normalizeCep(value));
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toAddress(cep: string, body: unknown): ViaCepAddress {
  if (!body || typeof body !== 'object') throw new CepLookupError('UNAVAILABLE');

  const response = body as Partial<ViaCepResponse>;
  if (response.erro === true) throw new CepLookupError('NOT_FOUND');

  return {
    bairro: asText(response.bairro),
    cep,
    cidade: asText(response.localidade),
    complemento: asText(response.complemento),
    endereco: asText(response.logradouro),
    uf: asText(response.uf),
  };
}

/** Looks up one normalized CEP without sending cookies, credentials, or other form data. */
export async function lookupCep(cepInput: string, signal?: AbortSignal): Promise<ViaCepAddress> {
  const cep = normalizeCep(cepInput);
  if (!isValidCep(cep)) throw new CepLookupError('INVALID');

  const cached = cache.get(cep);
  if (cached) return cached;

  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  signal?.addEventListener('abort', abortRequest, { once: true });
  const timeout = setTimeout(() => controller.abort(), CEP_TIMEOUT_MS);

  try {
    const response = await fetch(`${VIA_CEP_ENDPOINT}/${cep}/json/`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new CepLookupError('UNAVAILABLE');

    const address = toAddress(cep, await response.json());
    cache.set(cep, address);
    return address;
  } catch (error) {
    if (error instanceof CepLookupError) throw error;
    if (signal?.aborted) throw error;
    throw new CepLookupError('UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortRequest);
  }
}

/** Applies only address data returned by ViaCEP; number is intentionally not part of this helper. */
export function applyViaCepAddress<T extends AddressFormFields>(
  fields: T,
  address: ViaCepAddress,
): void {
  if (address.endereco) fields.endereco = address.endereco;
  if (address.bairro) fields.bairro = address.bairro;
  if (address.cidade) fields.cidade = address.cidade;
  if ('uf' in fields && address.uf) fields.uf = address.uf;

  // ViaCEP complemento is supplementary information. Never replace a value typed by the user.
  if (!fields.complemento && address.complemento) fields.complemento = address.complemento;
}

export function clearCepLookupCache(): void {
  cache.clear();
}
