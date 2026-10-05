import type { DatabaseConnection } from '@seduc/database';
import type { UserProfile } from '@seduc/contracts';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import type { Environment } from '../../src/config/env.js';
import { BCRYPT_COST, hashPassword } from '../../src/modules/auth/auth.crypto.js';
import type {
  AuthRepository,
  AuthSessionRecord,
  AuthUserRecord,
} from '../../src/modules/auth/auth.types.js';
import { createTestEnvironment } from '../helpers/environment.js';

const validPassword = 'Senha administrativa 2026!';
const userId = '0f84036e-7202-4e3e-a340-335c2260758f';

class InMemoryAuthRepository implements AuthRepository {
  readonly sessions = new Map<string, { expiraEm: Date; usuarioId: string }>();
  readonly users = new Map<string, AuthUserRecord>();

  async createSession(input: {
    expiraEm: Date;
    tokenHash: string;
    usuarioId: string;
  }): Promise<void> {
    this.sessions.set(input.tokenHash, {
      expiraEm: input.expiraEm,
      usuarioId: input.usuarioId,
    });
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const session = this.sessions.get(tokenHash);
    const user = session ? this.users.get(session.usuarioId) : undefined;
    return session && user ? { expiraEm: session.expiraEm, usuario: user } : null;
  }

  async findUserByIdentifier(identifier: string): Promise<AuthUserRecord | null> {
    return (
      [...this.users.values()].find(
        (user) => user.login === identifier || user.email === identifier,
      ) ?? null
    );
  }
}

function createDatabase(): DatabaseConnection {
  return {
    client: {} as DatabaseConnection['client'],
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(undefined),
  };
}

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(validPassword);
});

function createScenario(
  options: {
    active?: boolean;
    environment?: Partial<Environment>;
    profile?: UserProfile;
  } = {},
) {
  const repository = new InMemoryAuthRepository();
  repository.users.set(userId, {
    ativo: options.active ?? true,
    email: 'admin@seduc.test',
    id: userId,
    login: 'admin.seduc',
    nome: 'Administradora de Teste',
    perfil: options.profile ?? 'ADMINISTRADOR',
    senhaHash: passwordHash,
    unidades: [],
  });

  const app = createApp({
    authRepository: repository,
    database: createDatabase(),
    environment: createTestEnvironment(options.environment),
  });

  return { app, repository };
}

describe('authentication endpoints', () => {
  it('autentica pela credencial de login', async () => {
    const { app } = createScenario();
    const response = await request(app)
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', password: validPassword })
      .expect(200);

    expect(response.body.user).toMatchObject({ id: userId, login: 'admin.seduc' });
    expect(response.headers['set-cookie']?.[0]).toContain('seduc_session=');
  });

  it('autentica pela credencial de e-mail', async () => {
    const { app } = createScenario();
    const response = await request(app)
      .post('/auth/login')
      .send({ identifier: 'admin@seduc.test', password: validPassword })
      .expect(200);

    expect(response.body.user.email).toBe('admin@seduc.test');
  });

  it('usa a mesma resposta segura para senha errada, usuário inexistente e conta inativa', async () => {
    const invalidCredentials = {
      error: 'INVALID_CREDENTIALS',
      message: 'Credenciais inválidas.',
    };
    const wrongPassword = await request(createScenario().app)
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', password: 'senha-errada' })
      .expect(401);
    const missingUser = await request(createScenario().app)
      .post('/auth/login')
      .send({ identifier: 'nao-existe', password: 'senha-errada' })
      .expect(401);
    const inactiveUser = await request(createScenario({ active: false }).app)
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', password: validPassword })
      .expect(401);

    expect(wrongPassword.body).toEqual(invalidCredentials);
    expect(missingUser.body).toEqual(invalidCredentials);
    expect(inactiveUser.body).toEqual(invalidCredentials);
  });

  it('protege /auth/me quando não existe sessão', async () => {
    const response = await request(createScenario().app).get('/auth/me').expect(401);

    expect(response.body.error).toBe('AUTHENTICATION_REQUIRED');
  });

  it('valida estritamente o payload de login', async () => {
    const { app } = createScenario();
    const response = await request(app)
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', perfil: 'ADMINISTRADOR' })
      .expect(400);

    expect(response.body).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'Dados de entrada inválidos.',
    });
  });

  it('restaura uma sessão válida sem expor senha_hash', async () => {
    const { app } = createScenario();
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', password: validPassword })
      .expect(200);

    const response = await agent.get('/auth/me').expect(200);

    expect(response.body.user).toMatchObject({ id: userId, perfil: 'ADMINISTRADOR' });
    expect(response.text).not.toContain('senhaHash');
    expect(response.text).not.toContain('senha_hash');
    expect(response.text).not.toContain(passwordHash);
  });

  it('rejeita cookie de sessão adulterado', async () => {
    const { app } = createScenario();

    await request(app)
      .get('/auth/me')
      .set('Cookie', 'seduc_session=identificador.assinatura-adulterada')
      .expect(401);
  });

  it('rejeita e remove uma sessão expirada', async () => {
    const { app, repository } = createScenario();
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', password: validPassword })
      .expect(200);
    const session = [...repository.sessions.values()][0];
    expect(session).toBeDefined();
    session!.expiraEm = new Date(0);

    await agent.get('/auth/me').expect(401);
    expect(repository.sessions.size).toBe(0);
  });

  it('invalida a sessão no logout e limpa o cookie', async () => {
    const { app, repository } = createScenario();
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', password: validPassword })
      .expect(200);
    expect(repository.sessions.size).toBe(1);

    const response = await agent.post('/auth/logout').expect(204);

    expect(repository.sessions.size).toBe(0);
    expect(response.headers['set-cookie']?.[0]).toContain('seduc_session=;');
    await agent.get('/auth/me').expect(401);
  });

  it('remove o acesso quando o usuário é inativado depois do login', async () => {
    const { app, repository } = createScenario();
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', password: validPassword })
      .expect(200);

    repository.users.get(userId)!.ativo = false;

    await agent.get('/auth/me').expect(401);
    expect(repository.sessions.size).toBe(0);
  });

  it('respeita alteração de perfil realizada depois do login', async () => {
    const { app, repository } = createScenario();
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', password: validPassword })
      .expect(200);

    repository.users.get(userId)!.perfil = 'OPERADOR';

    const response = await agent.get('/auth/me').expect(200);
    expect(response.body.user.perfil).toBe('OPERADOR');
  });

  it('respeita alteração de unidade realizada depois do login', async () => {
    const { app, repository } = createScenario({ profile: 'DIRETOR' });
    const agent = request.agent(app);
    repository.users.get(userId)!.unidades = [{ id: 'unidade-a', nome: 'Unidade A' }];
    await agent
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', password: validPassword })
      .expect(200);

    repository.users.get(userId)!.unidades = [
      { id: 'unidade-b', nome: 'Unidade B' },
      { id: 'unidade-c', nome: 'Unidade C' },
    ];

    const response = await agent.get('/auth/me').expect(200);
    expect(response.body.user.unidades).toEqual([
      { id: 'unidade-b', nome: 'Unidade B' },
      { id: 'unidade-c', nome: 'Unidade C' },
    ]);
  });

  it('configura cookie HttpOnly, SameSite e Secure em produção', async () => {
    const repository = createScenario().repository;
    const app = createApp({
      authRepository: repository,
      database: createDatabase(),
      environment: createTestEnvironment({ NODE_ENV: 'production' }),
    });
    const response = await request(app)
      .post('/auth/login')
      .send({ identifier: 'admin.seduc', password: validPassword })
      .expect(200);
    const cookie = response.headers['set-cookie']?.[0] ?? '';

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Max-Age=');
  });

  it('mantém limites independentes para IPs diferentes atrás do proxy confiável', async () => {
    const { app } = createScenario({ environment: { TRUST_PROXY_HOPS: 1 } });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '198.51.100.10')
        .send({ identifier: 'admin.seduc', password: 'senha-errada' })
        .expect(401);
    }

    await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.20')
      .send({ identifier: 'admin.seduc', password: 'senha-errada' })
      .expect(401);

    await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.10')
      .send({ identifier: 'admin.seduc', password: 'senha-errada' })
      .expect(429);
  });

  it('bloqueia a sexta falha do mesmo IP atrás do proxy confiável', async () => {
    const { app } = createScenario({ environment: { TRUST_PROXY_HOPS: 1 } });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .send({ identifier: 'admin.seduc', password: 'senha-errada' })
        .expect(401);
    }

    const response = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ identifier: 'admin.seduc', password: 'senha-errada' })
      .expect(429);
    expect(response.body.error).toBe('TOO_MANY_REQUESTS');
  });

  it('ignora X-Forwarded-For quando nenhum proxy está configurado como confiável', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { app } = createScenario({ environment: { TRUST_PROXY_HOPS: 0 } });

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app)
          .post('/auth/login')
          .set('X-Forwarded-For', `198.51.100.${attempt + 1}`)
          .send({ identifier: 'admin.seduc', password: 'senha-errada' })
          .expect(401);
      }

      await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '198.51.100.200')
        .send({ identifier: 'admin.seduc', password: 'senha-errada' })
        .expect(429);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('gera hashes bcrypt com custo 12', () => {
    expect(bcrypt.getRounds(passwordHash)).toBe(BCRYPT_COST);
  });
});
