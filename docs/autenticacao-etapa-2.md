# Autenticação e autorização - Etapa 2

## Senhas

As senhas administrativas usam bcrypt por meio da biblioteca `bcryptjs`, com custo 12 e salt gerado pela própria biblioteca. A API rejeita senhas que excedam o limite de 72 bytes do bcrypt. Senhas em texto não são armazenadas nem registradas em logs.

## Sessões

O navegador recebe um cookie `seduc_session` com estas propriedades:

- `HttpOnly`;
- `SameSite=Lax`;
- `Secure` quando `NODE_ENV=production`;
- expiração configurada por `SESSION_TTL_HOURS`.

O cookie contém um identificador aleatório de 256 bits assinado com HMAC-SHA-256. O segredo vem exclusivamente de `SESSION_SECRET`, deve ter pelo menos 32 caracteres e não pode permanecer com o placeholder do `.env.example`.

Somente o hash SHA-256 do identificador é armazenado em `sessao_usuario`. Cada requisição autenticada consulta novamente a sessão e o usuário no PostgreSQL; inativação e alterações de perfil ou unidade têm efeito imediato. Logout remove a sessão no servidor e limpa o cookie.

As variáveis obrigatórias são `SESSION_SECRET` (segredo aleatório com pelo menos 32 caracteres) e `SESSION_TTL_HOURS` (entre 1 e 168 horas; padrão 8). O login limita cada endereço IP a cinco falhas por janela de 15 minutos. Respostas bem-sucedidas não consomem o limite.

`TRUST_PROXY_HOPS` controla quantos proxies reversos conhecidos o Express pode confiar ao interpretar `X-Forwarded-For`. O padrão é `0`, que ignora o cabeçalho recebido diretamente. Configure `1` somente quando a API estiver atrás de exatamente um proxy confiável; não use `true` nem um número maior que a topologia real. Quando o valor for maior que zero, a API não deve aceitar acesso público que contorne o proxy confiável.

Em produção, o navegador deve acessar a entrada pública por HTTPS porque o cookie continua obrigatoriamente `Secure`. A comunicação interna por HTTP entre o proxy e o container da API é aceita quando Traefik, Coolify ou solução equivalente termina o TLS.

## Rotas

- `POST /auth/login`: recebe `identifier` e `password`, usando somente `usuario.login` ou `usuario.email`;
- `GET /auth/me`: exige sessão válida e devolve apenas a identidade administrativa segura;
- `POST /auth/logout`: invalida a sessão persistida e limpa o cookie.

Não existe cadastro público, autenticação por CPF/matrícula ou recuperação de senha nesta etapa.

Login e e-mail compartilham um único espaço lógico de identificação. O bootstrap consulta conflitos cruzados pela política reutilizável da aplicação, e o PostgreSQL mantém um registro único sincronizado por trigger para impedir ambiguidades inclusive sob concorrência.

## Primeiro administrador

Não há administrador ou senha padrão. Em um banco novo, configure explicitamente:

```text
DATABASE_URL=postgresql://...
BOOTSTRAP_ADMIN_NAME=Nome do administrador
BOOTSTRAP_ADMIN_LOGIN=login-administrativo
BOOTSTRAP_ADMIN_EMAIL=admin@example.invalid
BOOTSTRAP_ADMIN_PASSWORD=uma-senha-forte-sem-valor-padrao
```

O e-mail é opcional; os demais valores são obrigatórios. Execute:

```text
pnpm --filter @seduc/api auth:bootstrap-admin
```

Se a mesma identidade administrativa já existir, o comando termina sem alterar a conta. Conflitos de login/e-mail ou perfil cancelam a operação. A senha nunca é exibida.

## RBAC

A política do backend é deny-by-default. Permissões e escopo de unidade ficam centralizados no módulo `authorization`. Diretor e Secretário usam exclusivamente a unidade carregada do usuário autenticado no banco; valores enviados pelo cliente não definem autorização.

Antes da introdução das primeiras rotas mutáveis de domínio, a proteção contra CSRF deverá ser revisada em conjunto com a topologia definitiva de implantação. Esta etapa não adiciona um mecanismo CSRF antecipado sem fluxo funcional para protegê-lo.
