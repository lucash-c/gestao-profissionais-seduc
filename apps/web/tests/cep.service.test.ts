import { flushPromises, mount } from '@vue/test-utils';
import { QInput, Quasar } from 'quasar';
import { defineComponent, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CepLookupInput from '@/components/CepLookupInput.vue';
import {
  applyViaCepAddress,
  clearCepLookupCache,
  isValidCep,
  lookupCep,
  normalizeCep,
} from '@/services/cep.service';

const knownAddress = {
  bairro: 'Centro',
  cep: '13465000',
  complemento: 'Sala 2',
  localidade: 'Americana',
  logradouro: 'Rua das Flores',
  uf: 'SP',
};

function jsonResponse(body: unknown, ok = true): Response {
  return { json: vi.fn().mockResolvedValue(body), ok } as unknown as Response;
}

function mountCepInput() {
  const addresses = ref<unknown[]>([]);
  const cep = ref('');
  const wrapper = mount(
    defineComponent({
      components: { CepLookupInput },
      setup() {
        return { addresses, cep };
      },
      template: '<CepLookupInput v-model="cep" @address-found="addresses.push($event)" />',
    }),
    { global: { plugins: [Quasar] } },
  );
  const input = () => wrapper.findComponent(QInput);
  return { addresses, cep, input, wrapper };
}

beforeEach(() => {
  clearCepLookupCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('serviço ViaCEP', () => {
  it('normaliza CEP com máscara e consulta apenas os oito dígitos sem credenciais', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(knownAddress));
    vi.stubGlobal('fetch', fetchMock);

    const address = await lookupCep('13 465-000');

    expect(normalizeCep('13 465-000')).toBe('13465000');
    expect(isValidCep('13465-000')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/13465000/json/',
      expect.objectContaining({ credentials: 'omit' }),
    );
    expect(address).toEqual({
      bairro: 'Centro',
      cep: '13465000',
      cidade: 'Americana',
      complemento: 'Sala 2',
      endereco: 'Rua das Flores',
      uf: 'SP',
    });
  });

  it('não consulta CEP incompleto ou inválido', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupCep('13465-00')).rejects.toMatchObject({
      reason: 'INVALID',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trata CEP inexistente e indisponibilidade sem converter em erro de cadastro', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ erro: true }))
      .mockRejectedValueOnce(new TypeError('network error'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupCep('13465000')).rejects.toMatchObject({
      reason: 'NOT_FOUND',
    });
    await expect(lookupCep('13466000')).rejects.toMatchObject({
      reason: 'UNAVAILABLE',
    });
  });

  it('reutiliza em memória uma consulta já concluída', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(knownAddress));
    vi.stubGlobal('fetch', fetchMock);

    await lookupCep('13465000');
    await lookupCep('13465-000');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('preenche os campos retornados, preserva número e complemento digitado e permite edição manual', () => {
    const form = {
      bairro: '',
      cidade: '',
      complemento: 'Fundos',
      endereco: '',
      numero: '42',
      uf: '',
    };

    applyViaCepAddress(form, {
      bairro: 'Centro',
      cep: '13465000',
      cidade: 'Americana',
      complemento: 'Sala 2',
      endereco: 'Rua das Flores',
      uf: 'SP',
    });

    expect(form).toMatchObject({
      bairro: 'Centro',
      cidade: 'Americana',
      complemento: 'Fundos',
      endereco: 'Rua das Flores',
      numero: '42',
      uf: 'SP',
    });
    form.endereco = 'Rua corrigida manualmente';
    expect(form.endereco).toBe('Rua corrigida manualmente');
  });
});

describe('campo reutilizável de CEP', () => {
  it('consulta ao completar oito dígitos e evita repetição no blur', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(knownAddress));
    vi.stubGlobal('fetch', fetchMock);
    const { addresses, input, wrapper } = mountCepInput();

    input().vm.$emit('update:modelValue', '13465-000');
    await flushPromises();
    input().vm.$emit('blur');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(addresses.value).toEqual([
      expect.objectContaining({
        bairro: 'Centro',
        cidade: 'Americana',
        endereco: 'Rua das Flores',
        uf: 'SP',
      }),
    ]);
    wrapper.unmount();
  });

  it('mostra validação discreta ao sair com CEP incompleto e não faz request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { input, wrapper } = mountCepInput();

    input().vm.$emit('update:modelValue', '13465');
    await nextTick();
    input().vm.$emit('blur');
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Informe um CEP com 8 dígitos.');
    wrapper.unmount();
  });

  it('mostra uma orientação amigável quando o ViaCEP não encontra o número informado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ erro: true })));
    const { input, wrapper } = mountCepInput();

    input().vm.$emit('update:modelValue', '13465000');
    await flushPromises();

    expect(wrapper.text()).toContain(
      'CEP não encontrado. Confira o número informado ou preencha o endereço manualmente.',
    );
    wrapper.unmount();
  });

  it('mantém somente a resposta do CEP mais recente', async () => {
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveSecond = resolve)));
    vi.stubGlobal('fetch', fetchMock);
    const { addresses, input, wrapper } = mountCepInput();

    input().vm.$emit('update:modelValue', '13465000');
    await nextTick();
    input().vm.$emit('update:modelValue', '13466000');
    await nextTick();
    resolveSecond(jsonResponse({ ...knownAddress, bairro: 'Vila Nova', cep: '13466000' }));
    await flushPromises();
    resolveFirst(jsonResponse(knownAddress));
    await flushPromises();

    expect(addresses.value).toEqual([
      expect.objectContaining({ bairro: 'Vila Nova', cep: '13466000' }),
    ]);
    wrapper.unmount();
  });

  it('informa falha externa e mantém o formulário disponível para preenchimento manual', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')));
    const { input, wrapper } = mountCepInput();

    input().vm.$emit('update:modelValue', '13465000');
    await flushPromises();

    expect(wrapper.text()).toContain(
      'Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente.',
    );
    expect(input().props('disable')).not.toBe(true);
    wrapper.unmount();
  });
});
