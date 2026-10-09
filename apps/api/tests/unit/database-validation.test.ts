import { describe, expect, it } from 'vitest';

import { eventCreateSchema } from '../../src/modules/events/event.schemas.js';
import {
  passwordResetSchema,
  unitCreateSchema,
} from '../../src/modules/registries/registry.schemas.js';
import { databaseIdSchema } from '../../src/validation/database-id.js';

describe('validação compartilhada de banco e formulários', () => {
  it.each([
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '0f84036e-7202-4e3e-a340-335c2260758f',
  ])('aceita UUID PostgreSQL canônico %s sem impor bits de versão', (id) => {
    expect(databaseIdSchema.parse(id)).toBe(id);
  });

  it.each(['', '10000000', 'not-a-uuid', '10000000-0000-0000-0000-00000000000z'])(
    'rejeita identificador malformado %s',
    (id) => expect(() => databaseIdSchema.parse(id)).toThrow(),
  );

  it('aceita códigos estruturais na criação de unidade e evento', () => {
    expect(
      unitCreateSchema.parse({
        nome: 'Unidade de exemplo',
        tipoUnidadeId: 'CENTRO_DE_INCLUSAO',
      }).tipoUnidadeId,
    ).toBe('CENTRO_DE_INCLUSAO');
    expect(
      eventCreateSchema.parse({
        ano: 2026,
        cargoFuncaoId: 'PEB1_FUNDAMENTAL',
        nome: 'Evento de exemplo',
        tipo: 'REMOCAO',
      }).cargoFuncaoId,
    ).toBe('PEB1_FUNDAMENTAL');
  });

  it('aplica os limites 12 e 72 na redefinição de senha', () => {
    expect(() => passwordResetSchema.parse({ senha: 'a'.repeat(11) })).toThrow();
    expect(passwordResetSchema.parse({ senha: 'a'.repeat(12) }).senha).toHaveLength(12);
    expect(passwordResetSchema.parse({ senha: 'a'.repeat(72) }).senha).toHaveLength(72);
    expect(() => passwordResetSchema.parse({ senha: 'a'.repeat(73) })).toThrow();
  });
});
