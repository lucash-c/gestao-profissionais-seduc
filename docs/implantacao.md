# Implantação

## Pré-requisitos

- host Linux com Docker Engine e Compose atualizados;
- DNS e proxy reverso com HTTPS válido;
- volume persistente e monitorado para PostgreSQL 17;
- cofre de segredos para senha do banco e `SESSION_SECRET`;
- rotina externa de cópia e retenção dos backups.

## Preparação

1. Fixe a revisão aprovada da imagem/repositório.
2. Gere uma senha exclusiva do PostgreSQL e um `SESSION_SECRET` aleatório de 32 a 256 caracteres.
3. Defina `CORS_ORIGIN` com a URL HTTPS exata, sem curinga.
4. Mantenha `WEB_BIND_ADDRESS=127.0.0.1` quando Traefik/Coolify estiver no mesmo host.
5. Ajuste `TRUST_PROXY_HOPS` ao número exato de proxies confiáveis. O Compose pressupõe um.
6. Valide a configuração sem imprimir o ambiente no log:

```bash
docker compose -f compose.production.yaml config --quiet
docker compose -f compose.production.yaml build
```

## Primeira subida

```bash
docker compose -f compose.production.yaml up -d
docker compose -f compose.production.yaml ps
```

O serviço `migrate` precisa terminar com código zero antes da API. O PostgreSQL não possui porta
publicada. O Nginx é a única entrada do conjunto e encaminha `/api` para a API.

Crie o primeiro administrador com o script explícito descrito no README. Não existe credencial
automática em `NODE_ENV=production`.

## Proxy HTTPS (Coolify/Traefik)

- publique somente o serviço web;
- termine TLS no proxy;
- preserve `Host`, `X-Forwarded-For` e `X-Forwarded-Proto`;
- não crie rota externa direta para a API ou o banco;
- não aumente `TRUST_PROXY_HOPS` para “resolver” IP incorreto;
- confirme que o cookie de sessão chega como `Secure`, `HttpOnly` e `SameSite=Lax`.

## Aceite antes de liberar usuários

1. `GET /api/health/live` retorna `200`.
2. `GET /api/health/ready` retorna `200`.
3. login do administrador individual funciona por HTTPS.
4. login inválido não revela se a conta existe.
5. banco, API e painel administrativo não estão expostos fora dos caminhos planejados.
6. backup custom e restauração em banco descartável foram executados.
7. retenção, espaço em disco, relógio/NTP e alertas foram configurados.
8. o checklist em `docs/checklist-aceite-v4.md` foi revisado pela equipe responsável.

## Upgrade e rollback operacional

1. gere e valide um backup antes do upgrade;
2. registre a imagem/SHA atualmente em produção;
3. execute o serviço `migrate` e só então substitua API/web;
4. valide readiness e um fluxo somente leitura;
5. migrations são progressivas: não execute downgrade improvisado;
6. se o upgrade falhar antes da migration, volte às imagens anteriores;
7. se houver alteração de banco confirmada, recupere somente conforme plano de restauração aprovado.

Nunca edite uma migration já aplicada e nunca restaure por cima do banco oficial sem janela,
backup validado e autorização formal.
