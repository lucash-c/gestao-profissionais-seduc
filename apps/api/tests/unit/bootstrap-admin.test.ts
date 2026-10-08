import { describe, expect, it, vi } from 'vitest';

import {
  bootstrapFirstAdministrator,
  bootstrapInitialSeducAdministrator,
  type BootstrapAdminInput,
  type BootstrapAdminRepository,
  type InitialAdminRepository,
  INITIAL_SEDUC_ADMINISTRATOR,
} from '../../src/modules/users/bootstrap-admin.service.js';
import {
  passwordResetSchema,
  userCreateSchema,
} from '../../src/modules/registries/registry.schemas.js';
import type { UserIdentifierOwner } from '../../src/modules/users/user-identifier.service.js';

type AdminOwner = UserIdentifierOwner & { perfil: 'ADMINISTRADOR' | 'OPERADOR' };

function createRepository(owners: AdminOwner[]) {
  const createAdmin = vi.fn<BootstrapAdminRepository['createAdmin']>().mockResolvedValue(undefined);
  const repository: BootstrapAdminRepository = {
    createAdmin,
    async findByIdentifiers(identifiers) {
      return owners.filter(
        ({ email, login }) => identifiers.includes(login) || (email && identifiers.includes(email)),
      );
    },
  };

  return { createAdmin, repository };
}

const baseInput: BootstrapAdminInput = {
  email: 'novo.email@seduc.test',
  login: 'novo.login',
  nome: 'Nova Administradora',
  password: 'Senha administrativa 2026!',
};

describe('bootstrapFirstAdministrator', () => {
  it.each([
    {
      existing: { email: 'outro@seduc.test', login: baseInput.login },
      label: 'login já existente',
    },
    {
      existing: { email: baseInput.email, login: 'outro.login' },
      label: 'e-mail já existente',
    },
    {
      existing: { email: baseInput.login, login: 'outro.login' },
      label: 'novo login igual ao e-mail de outra conta',
    },
    {
      existing: { email: 'outro@seduc.test', login: baseInput.email! },
      label: 'novo e-mail igual ao login de outra conta',
    },
  ])('rejeita $label', async ({ existing }) => {
    const { createAdmin, repository } = createRepository([
      {
        ...existing,
        id: 'usuario-existente',
        perfil: 'OPERADOR',
      },
    ]);
    const passwordHasher = vi.fn().mockResolvedValue('hash');

    await expect(
      bootstrapFirstAdministrator(repository, baseInput, passwordHasher),
    ).rejects.toMatchObject({ name: 'UserIdentifierConflictError' });
    expect(passwordHasher).not.toHaveBeenCalled();
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it('mantém a mesma identidade administrativa de forma idempotente', async () => {
    const { createAdmin, repository } = createRepository([
      {
        email: baseInput.email,
        id: 'administrador-existente',
        login: baseInput.login,
        perfil: 'ADMINISTRADOR',
      },
    ]);
    const passwordHasher = vi.fn().mockResolvedValue('hash');

    await expect(bootstrapFirstAdministrator(repository, baseInput, passwordHasher)).resolves.toBe(
      'unchanged',
    );
    expect(passwordHasher).not.toHaveBeenCalled();
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it('cria o primeiro administrador com a senha transformada em hash', async () => {
    const { createAdmin, repository } = createRepository([]);
    const passwordHasher = vi.fn().mockResolvedValue('hash-bcrypt');

    await expect(bootstrapFirstAdministrator(repository, baseInput, passwordHasher)).resolves.toBe(
      'created',
    );
    expect(createAdmin).toHaveBeenCalledWith({
      email: baseInput.email,
      login: baseInput.login,
      nome: baseInput.nome,
      senhaHash: 'hash-bcrypt',
    });
  });
});

function createInitialRepository(initialUsers = 0) {
  let users = initialUsers;
  let queue = Promise.resolve();
  const createAdmin = vi.fn(async () => {
    users += 1;
  });
  const repository: InitialAdminRepository = {
    async runExclusive(operation) {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await operation({
          countUsers: async () => users,
          createAdmin,
        });
      } finally {
        release();
      }
    },
  };
  return { createAdmin, repository, userCount: () => users };
}

describe('bootstrapInitialSeducAdministrator', () => {
  it('cria uma única conta SEDUC somente quando não existe nenhum usuário', async () => {
    const { createAdmin, repository, userCount } = createInitialRepository();
    const passwordHasher = vi.fn().mockResolvedValue('hash-bcrypt');

    await expect(
      bootstrapInitialSeducAdministrator(repository, passwordHasher, 'test'),
    ).resolves.toBe('created');
    await expect(
      bootstrapInitialSeducAdministrator(repository, passwordHasher, 'test'),
    ).resolves.toBe('unchanged');
    expect(userCount()).toBe(1);
    expect(passwordHasher).toHaveBeenCalledOnce();
    expect(passwordHasher).toHaveBeenCalledWith(INITIAL_SEDUC_ADMINISTRATOR.password);
    expect(createAdmin).toHaveBeenCalledWith({
      email: null,
      login: 'seduc',
      nome: 'SEDUC',
      senhaHash: 'hash-bcrypt',
    });
  });

  it('não cria SEDUC quando qualquer usuário já existe', async () => {
    const { createAdmin, repository } = createInitialRepository(1);
    const passwordHasher = vi.fn().mockResolvedValue('hash-bcrypt');

    await expect(
      bootstrapInitialSeducAdministrator(repository, passwordHasher, 'test'),
    ).resolves.toBe('unchanged');
    expect(passwordHasher).not.toHaveBeenCalled();
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it('serializa execuções concorrentes e cria exatamente uma conta', async () => {
    const { createAdmin, repository, userCount } = createInitialRepository();
    const passwordHasher = vi.fn().mockResolvedValue('hash-bcrypt');

    await expect(
      Promise.all([
        bootstrapInitialSeducAdministrator(repository, passwordHasher, 'test'),
        bootstrapInitialSeducAdministrator(repository, passwordHasher, 'test'),
      ]),
    ).resolves.toEqual(['created', 'unchanged']);
    expect(userCount()).toBe(1);
    expect(createAdmin).toHaveBeenCalledOnce();
  });

  it('propaga falhas inesperadas e não enfraquece a política comum de senha', async () => {
    const repository: InitialAdminRepository = {
      runExclusive: vi.fn().mockRejectedValue(new Error('banco indisponível')),
    };
    await expect(bootstrapInitialSeducAdministrator(repository, vi.fn(), 'test')).rejects.toThrow(
      'banco indisponível',
    );

    expect(() =>
      userCreateSchema.parse({
        login: 'administrador',
        nome: 'Administrador',
        perfil: 'ADMINISTRADOR',
        senha: INITIAL_SEDUC_ADMINISTRATOR.password,
        unidadeIds: [],
      }),
    ).toThrow();
    expect(() =>
      passwordResetSchema.parse({ senha: INITIAL_SEDUC_ADMINISTRATOR.password }),
    ).toThrow();
  });

  it('é impossível executar o bootstrap conhecido em produção', async () => {
    const { createAdmin, repository } = createInitialRepository();
    const passwordHasher = vi.fn().mockResolvedValue('hash-bcrypt');

    await expect(
      bootstrapInitialSeducAdministrator(repository, passwordHasher, 'production'),
    ).resolves.toBe('disabled');
    expect(passwordHasher).not.toHaveBeenCalled();
    expect(createAdmin).not.toHaveBeenCalled();
  });
});
