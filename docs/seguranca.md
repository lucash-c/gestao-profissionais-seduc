# Segurança

## Autenticação e sessão

- somente usuários administrativos autenticam; profissional não possui autoatendimento;
- login aceita login ou e-mail e aplica limite de cinco falhas em quinze minutos;
- comparação de senha usa bcrypt inclusive no caminho de usuário inexistente;
- sessão usa token aleatório assinado e persiste somente SHA-256 do token;
- cookie é `HttpOnly`, `SameSite=Lax` e `Secure` em produção;
- expiração é validada no servidor e sessão expirada é removida;
- inativação do usuário invalida seu próximo acesso autenticado;
- logout apaga a sessão do banco e limpa o cookie.

## Primeiro acesso

O bootstrap conhecido é aceito apenas em `development`/`test`. O serviço retorna `disabled` em
`production` antes de adquirir lock ou consultar o banco. Produção usa o comando explícito
`auth:bootstrap-admin`, com nome, login e senha fortes fornecidos por ambiente. A senha nunca é
registrada.

## Autorização e escopo

Todas as rotas administrativas passam por autenticação e pelas políticas de backend. Escopo de
unidade não depende da visibilidade de botões. Somente `OPERADOR` gerencia/opera eventos; somente
`ADMINISTRADOR` altera pontuação, usuários globais, quadro, auditoria e correção excepcional.
Diretores podem ter várias unidades vinculadas; Secretário possui uma unidade.

## CORS e CSRF

`CORS_ORIGIN` contém origens completas explicitamente permitidas. Mutações autenticadas exigem
`Origin` permitido em produção. Clientes de teste/desenvolvimento podem omiti-lo, nunca produção.
Não configure curinga com credenciais.

## Proxy

`TRUST_PROXY_HOPS=0` é o padrão seguro para acesso direto. Configure a contagem exata quando houver
proxy conhecido e bloqueie acesso direto à API. Confiar em mais saltos que a topologia real permite
forjar endereço de origem e enfraquece o rate limit.

## Logs e dados pessoais

O logger registra método, caminho sem query, status, duração e tipo genérico de erro. Ele não
registra payload, headers, query string, cookie, token, senha, hash, `SESSION_SECRET` ou
`DATABASE_URL`. Erros 500 e healthchecks não devolvem nem registram message/stack interna.

Evite adicionar `console.log` de objetos de requisição, Prisma ou ambiente. Logs devem possuir
controle de acesso, retenção curta e descarte seguro.

## API pública

Os endpoints `/public/eventos/:id/telao` e `/public/eventos/:id/escolhas` retornam somente:

- nome/ano/tipo/status do evento;
- nome e posição pública na fila;
- unidade, período, tipo e horário das escolhas;
- totais agregados de vagas.

Não retornam CPF, matrícula, nascimento, endereço, telefone, IDs internos, operador ou auditoria.
Testes de integração verificam a projeção sanitizada.

## Erros e disponibilidade

- validações retornam mensagem administrativa estável;
- falhas inesperadas retornam `INTERNAL_SERVER_ERROR` sem detalhes;
- liveness não consulta dependências;
- readiness executa consulta mínima e só informa `up`/`down`;
- transações PostgreSQL, locks e constraints protegem concorrência e rollback integral.

## Resposta a incidente

1. preserve logs e identifique a revisão implantada;
2. revogue sessões pela inativação de usuário ou limpeza controlada de sessões;
3. rotacione `SESSION_SECRET`, credenciais do banco e credenciais administrativas afetadas;
4. restrinja a entrada no proxy sem expor API/banco;
5. recupere dados somente por backup validado;
6. documente escopo, horários, responsáveis e medidas corretivas.
