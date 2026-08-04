# Usuários por área/cargo via API do Taskrow — design

## Objetivo

Hoje `src/lib/constants.ts` mantém duas tabelas escritas à mão (`NUCLEO_MEMBERS`:
pessoa → núcleo; `USER_CARGO`: pessoa → cargo) que precisam ser atualizadas manualmente
sempre que alguém entra, sai ou muda de time/cargo (dívida técnica já documentada no
`CLAUDE.md` do projeto). Este design substitui as duas tabelas por dados buscados ao
vivo da API do Taskrow.

## Descoberta (validada com dados reais)

- A API de tarefas já em uso (`Dashboard/TasksByGroup`) carrega por tarefa
  `FunctionGroupTitle` (departamento, ex. "Criação", "Mídia") e `UserFunctionTitle`
  (cargo, ex. "Diretor(a) de Arte Sênior") — mas nenhum dos dois distingue os núcleos
  atuais (BORBA-DESIGN, HOSKEN/LEANDRO etc.), que são "duplas" internas dentro do
  departamento "Criação" sem correspondência no Taskrow.
- Existe um endpoint não documentado no manual da API mas funcional com a chave já
  configurada: `GET /api/v1/User/ListUsers` — retorna todos os usuários ativos da
  empresa (249 no teste) com os campos `UserLogin`, `ApprovalGroup`,
  `FunctionGroupName`, `UserFunctionTitle`.
- `ApprovalGroup` é exatamente o "grupo de aprovação" que hoje corresponde a
  `NUCLEO_MEMBERS`: comparando os 6 núcleos atuais com `ApprovalGroup` real, batem
  quase 1:1 (BORBA - DESIGN, HOSKEN/LEANDRO, MURILO/RENATA, PA/TAVINHO, Criação
  MIDWAY idênticos; o que hoje é rotulado "VANESSA/PAULA" aparece na API só como
  "PAULA"). `UserFunctionTitle` bate exatamente com os valores hoje hardcoded em
  `USER_CARGO`.
- Filtrando por `FunctionGroupName === 'Criação'`, aparecem só grupos de aprovação
  realmente ligados à Criação — inclusive um núcleo real que nunca foi adicionado à
  lista estática (**KLEYTON**, liderado por Kleyton Mourão, 5 pessoas) — e o grupo
  "CRIAÇÃO" puro (3 pessoas: Armando Araujo, Carla Cancellara, Rui Branquinho —
  liderança sênior/CCOs, não ligados a um núcleo específico).
- 5 pessoas hoje hardcoded em `NUCLEO_MEMBERS` (Marcel Zylberman, Danilo Schiavon,
  Vanessa Jansen, Leticia Lourenço, Debora Cissoto) não existem mais no `ListUsers` —
  provavelmente já saíram da empresa; a sincronização via API as remove
  automaticamente.

## Decisões

1. Núcleo passa a ser **descoberto dinamicamente**: todo `ApprovalGroup` distinto
   entre usuários com `FunctionGroupName === 'Criação'`, **exceto** o grupo
   "CRIAÇÃO" puro (liderança sênior, excluída do dashboard). Núcleos novos que
   surgirem no Taskrow (ex. um 8º núcleo amanhã) aparecem sozinhos, sem alteração de
   código.
2. Nome do núcleo = valor literal de `ApprovalGroup` (ex. "PAULA", não mais
   "VANESSA/PAULA").
3. Cor do núcleo: gerada via `getColorForString()` (já existe, usada hoje para
   clientes) em vez do mapa estático `NUCLEO_COLORS`.
4. Ordem de exibição: alfabética (`localeCompare` pt-BR), como já é feito hoje para
   clientes em `useClienteData`.
5. Cargo por pessoa = `UserFunctionTitle` do `ListUsers`, usado como está hoje por
   `getCargoWeight` (mesma lógica de match por substring: assistente/junior/pleno/
   senior/diretor).

## Dados

### `src/lib/taskrow.ts`

Nova função, no mesmo padrão de `fetchTaskrowTasks`:

```ts
export interface TaskrowUser {
  UserLogin: string;
  ApprovalGroup: string;
  FunctionGroupName: string;
  UserFunctionTitle: string;
}

export async function fetchTaskrowUsers(): Promise<TaskrowUser[]>
```

Busca `User/ListUsers`, mapeia só os 4 campos usados (o payload real tem ~20 campos;
o resto é ignorado).

O helper interno de URL (hoje hardcoded para `Dashboard/TasksByGroup` dentro de
`fetchTaskrowTasks`) precisa generalizar para aceitar o path do endpoint:

```ts
function buildTaskrowUrl(path: string, params: Record<string, string>): string
```

- Em dev: `${API_BASE}/api/v1/${path}?${qs}` — o proxy `/taskrow-api` do
  `vite.config.ts` já encaminha qualquer path para `we.taskrow.com` com o header
  `__identifier`, sem mudança necessária ali.
- Em produção: `/api/taskrow?path=${encodeURIComponent(path)}&${qs}`.

### `api/taskrow.ts` (proxy serverless)

Hoje hardcoded para `Dashboard/TasksByGroup`. Passa a ler o path de um query param
`path` e repassar o restante da query string:

```ts
const path = searchParams.get('path') || 'Dashboard/TasksByGroup'; // default mantém compat
searchParams.delete('path');
const url = `${base}/api/v1/${path}?${searchParams.toString()}`;
```

### `src/hooks/useTaskrowUsers.ts` (novo)

Espelha `useTaskrowData.ts`:

```ts
export function useTaskrowUsers() {
  return useQuery<TaskrowUser[], Error>({
    queryKey: ['taskrow-users'],
    queryFn: fetchTaskrowUsers,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
```

### `src/lib/constants.ts`

Removidos: `NUCLEO_MEMBERS`, `USER_CARGO`, `NUCLEO_COLORS` (estático),
`NUCLEO_ORDER` (estático), `getNucleoMembers()`, `getNucleoByLogin()`,
`getCargoWeight()` na forma atual (leem constantes do módulo).

Adicionados — mesma normalização (lowercase, trim, remove acentos) já usada hoje:

```ts
export interface NucleoDirectory {
  order: string[];                       // núcleos distintos, ordem alfabética
  colors: Record<string, string>;        // núcleo → cor (getColorForString)
  membersByNucleo: Record<string, string[]>; // núcleo → logins normalizados
  nucleoByLogin: Record<string, string>;     // login normalizado → núcleo
  cargoByLogin: Record<string, string>;      // login normalizado → UserFunctionTitle
}

export function buildNucleoDirectory(users: TaskrowUser[]): NucleoDirectory
export function getNucleoByLogin(login: string, dir: NucleoDirectory): string | null
export function getCargoWeight(login: string, dir: NucleoDirectory): number
```

`buildNucleoDirectory` filtra `FunctionGroupName === 'Criação' && ApprovalGroup !==
'CRIAÇÃO'`, agrupa por `ApprovalGroup`. `getCargoWeight` mantém a lógica atual de
match por substring de senioridade (`CARGO_WEIGHT_BY_LEVEL`), só troca a fonte do
cargo bruto de `USER_CARGO[login]` para `dir.cargoByLogin[login]`.

### `src/hooks/useNucleoData.ts` e `src/hooks/useClienteData.ts`

Ganham parâmetro `dir: NucleoDirectory`:

```ts
export function useNucleoData(openTasks: TaskrowTask[], dir: NucleoDirectory): NucleoStats[]
export function buildClienteStats(openTasks: TaskrowTask[], dir: NucleoDirectory): ClienteStats[]
export function useClienteData(openTasks: TaskrowTask[], dir: NucleoDirectory): ClienteStats[]
```

Corpo das funções: troca `NUCLEO_ORDER`/`getNucleoMembers`/`getCargoWeight()` pelos
equivalentes de `dir`; resto da lógica (buckets de prazo, workload, etc.) não muda.

### Páginas consumidoras

`TimelinePage.tsx`, `SwimlanePage.tsx`, `ClientesPage.tsx`, `CalendarioPage.tsx` e
`BarrasPage.tsx` (não roteada, mas precisa continuar compilando) passam a chamar
`useTaskrowUsers()` além de `useTaskrowData()`, e repassar
`buildNucleoDirectory(users ?? [])` para `useNucleoData`/`useClienteData`. Estado de
loading passa a considerar as duas queries (`tasksQuery.isLoading ||
usersQuery.isLoading`), mesmo padrão de erro já usado hoje para a query de tarefas.

`Layout.tsx` (usa `useTaskrowData()` só para o timestamp de "última atualização" e
botão de refresh manual) não precisa mudar.

## Fora de escopo

- Não altera a UI (nenhum componente novo de tela) — só a fonte dos dados de
  núcleo/cargo.
- Não filtra por `Inactive`: o campo existe no payload real mas retornou `false`
  para todos os 249 usuários no teste (o endpoint parece já excluir inativos por
  padrão), então `TaskrowUser` nem inclui esse campo. Se isso mudar no futuro,
  usuários inativos passariam a aparecer sem tratamento especial.
- Não pagina o `ListUsers` (retornou os 249 usuários numa chamada só).
