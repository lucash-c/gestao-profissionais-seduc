import { Quasar } from 'quasar';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DataComparison from '@/components/DataComparison.vue';
import StatusChip from '@/components/StatusChip.vue';

describe('componentes semânticos Fluent', () => {
  it('mantém texto e ícone nos estados sem depender somente da cor', () => {
    const wrapper = mount(StatusChip, {
      global: { plugins: [Quasar] },
      props: { status: 'EMPATE_PENDENTE' },
    });

    expect(wrapper.text()).toContain('Empate pendente');
    expect(wrapper.attributes('aria-label')).toBe('Status: Empate pendente');
    expect(wrapper.classes()).toContain('status-chip--warning');
    expect(wrapper.find('.q-icon').exists()).toBe(true);
  });

  it('apresenta comparação legível e preserva JSON como detalhe técnico', () => {
    const wrapper = mount(DataComparison, {
      props: {
        antes: { ativo: true, nomeCompleto: 'Nome anterior' },
        depois: { ativo: true, nomeCompleto: 'Nome corrigido' },
      },
    });

    expect(wrapper.get('[data-testid="data-comparison"]').text()).toContain('Nome anterior');
    expect(wrapper.get('[data-testid="data-comparison"]').text()).toContain('Nome corrigido');
    expect(wrapper.findAll('.data-comparison__row--changed')).toHaveLength(1);
    expect(wrapper.text()).toContain('Ver JSON técnico');
  });
});
