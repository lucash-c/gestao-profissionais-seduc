# Mockups V4 - SEDUC Americana

Os arquivos `code.html` são a referência funcional autoritativa desta versão. Os `screen.png` originais foram preservados apenas como referência visual do Stitch e podem conter textos de demonstração anteriores.

Correções V4 aplicadas ao HTML:

- CRUD de Profissionais, Unidades e Postos/Vagas contextualizado como **Administrador**; Operador permanece somente nas telas operacionais do evento.
- Login sem criação pública de usuário e com autenticação por **login ou e-mail**.
- Pontuação do professor simplificada para valor oficial cadastral; o sistema **não calcula** tempo/títulos/assiduidade.
- Remoção/Permuta mantidas como manifestações prévias; sem pressupor par de permuta antecipado.
- Preparação da fila de Remoção mantém todos visíveis, mas somente `remocao=true` é elegível para a fila final; busca não esconde linhas.
- Fila só é congelada ao **iniciar o evento**.
- Central reconciliada com a fila de demonstração da Preparação.
- Consulta de vagas demonstra apenas cargo/período compatíveis.
- Postos/Vagas usa **Inativar** em vez de excluir, preservando histórico; UI de vaga representa disponibilidade de um posto, não uma tabela independente obrigatória.
- Telão identifica as **últimas 5 escolhas** e acesso às anteriores.

Consulte a documentação V4 para regras completas de RBAC, modelagem e transações.
