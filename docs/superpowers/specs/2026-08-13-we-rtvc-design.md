# Design: we-rtvc — dashboard de carga de trabalho para a área RTVC

## Contexto

O `we-criacao` é um dashboard que visualiza tarefas abertas do Taskrow, agrupadas por núcleo (squad) da área "Criação", com cálculo de carga de trabalho/capacidade por janela de tempo. A área RTVC (departamento diferente no Taskrow, `FunctionGroupName = 'RTVC'`) quer o mesmo tipo de dashboard, mas escopado a apenas dois núcleos: **RTVC** e **Motion**.

## Objetivo

Criar `we-rtvc`: um novo projeto, repositório GitHub e deploy Vercel independentes, com o mesmo funcionamento, páginas e métricas do `we-criacao`, mudando apenas o filtro de núcleos/departamento e o branding textual.

## Decisões

1. **Repositório independente**, não monorepo. `we-rtvc` é uma cópia do código-fonte do `we-criacao`, com deploy e ciclo de vida totalmente separados. Trade-off aceito: futuras correções/features precisam ser replicadas manualmente entre os dois projetos caso se apliquem a ambos.
2. **Único ponto de lógica de negócio a mudar**: `buildNucleoDirectory()` em `src/lib/constants.ts`. Toda a aplicação (páginas, `useNucleoData`, `useClienteData`, cálculo de workload/capacidade) já é agnóstica de área — depende só do `NucleoDirectory` que essa função produz. A mudança:
   - `FunctionGroupName` alvo passa de `'Criação'` para `'RTVC'`.
   - Em vez do padrão exclude-list do we-criacao (`EXCLUDED_APPROVAL_GROUPS`), usa uma **allowlist** `ALLOWED_APPROVAL_GROUPS = new Set(['RTVC', 'Motion'])`, confirmada pelo usuário como os nomes exatos de `ApprovalGroup` no Taskrow. Allowlist é mais seguro aqui porque queremos exatamente 2 núcleos fixos, sem risco de um `ApprovalGroup` futuro dentro do departamento RTVC vazar para o dashboard.
3. **Todo o resto do funcionamento é idêntico**: as 4 páginas (Dashboard/Timeline, Tarefas/Swimlane, Calendário, Clientes), o cálculo de workload por complexidade × cargo × capacidade base por janela, as cores de heat (verde/amarelo/vermelho), a suíte de testes (`bun test` sobre `src/lib` e `src/hooks`).
4. **Credenciais Taskrow reaproveitadas**: mesma instância/API key (`VITE_TASKROW_URL`, `VITE_TASKROW_API_KEY`) do we-criacao — os dados de RTVC/Motion já estão na mesma base Taskrow, só filtrados por departamento diferente.
5. **Branding**: mantém a mesma identidade visual (cores, layout, componentes) e a mesma logo (`wetrack.jpg`) por enquanto. Muda apenas texto: `<title>` do `index.html` (de `we-criacao` para `we-rtvc`), e nome do projeto em `package.json`/`README.md`. Sem diferenciação de cor de destaque.
6. **Deploy**: novo repositório GitHub `xandeoborges/we-rtvc` (mesma visibilidade do we-criacao) e novo projeto Vercel `we-rtvc` no time `ale-borges-projects`, auto-deploy de `main` via integração GitHub — espelhando a config do we-criacao (incluindo o proxy serverless `api/taskrow.ts` com o mesmo allowlist de paths `Dashboard/TasksByGroup` e `User/ListUsers`).

## Fora de escopo

- Diferenciação visual/tema entre os dois dashboards além do texto.
- Qualquer mudança na lógica de workload/capacidade, buckets de prazo, ou nas páginas em si — são cópias funcionais exatas.
- Unificação de código entre os dois projetos (sem monorepo/pacote compartilhado).
- `BarrasPage.tsx` continua não roteado (código morto), como no we-criacao.

## Passos de alto nível

1. Criar novo diretório `/Users/user/antigravity/we-rtvc` copiando a árvore de código do we-criacao (excluindo `node_modules`, `dist`, `.git`, `.env`).
2. `git init` novo repositório local, primeiro commit.
3. Ajustar `src/lib/constants.ts`: trocar `CRIACAO_DEPARTMENT`/`EXCLUDED_APPROVAL_GROUPS` por `RTVC_DEPARTMENT = 'RTVC'` e `ALLOWED_APPROVAL_GROUPS = new Set(['RTVC', 'Motion'])`; ajustar a lógica de filtro em `buildNucleoDirectory` de exclude para allow.
4. Atualizar testes existentes (`src/lib/constants.test.ts` se existir, ou criar) para cobrir o novo filtro allowlist.
5. Atualizar branding textual: `index.html` `<title>`, `package.json` `name`, `README.md`.
6. Atualizar `CLAUDE.md` do novo projeto refletindo a mudança de departamento/allowlist.
7. Criar `.env` local com as mesmas credenciais Taskrow (não versionado).
8. Rodar `bun install`, `bun run build`, `bun test`, `bun run lint` para validar que a cópia funciona igual ao original.
9. Criar repositório GitHub `we-rtvc` e push.
10. Criar projeto Vercel `we-rtvc`, configurar env vars de produção (`VITE_TASKROW_URL`, `VITE_TASKROW_API_KEY`, `VITE_TASKROW_GROUP_ID`), conectar ao GitHub para auto-deploy.
11. Validar em produção: núcleos exibidos são exatamente RTVC e Motion, dados carregando corretamente.

## Riscos / pontos de atenção

- Se `ApprovalGroup` no Taskrow não for exatamente `'RTVC'`/`'Motion'` (acentuação, maiúsculas, etc.), o allowlist não vai casar e o dashboard aparecerá vazio — validar localmente contra a API real antes do deploy (passo 8).
- Repositório novo precisa de configuração de secrets/env vars manual na Vercel, igual ao we-criacao (não há como copiar isso via git).
