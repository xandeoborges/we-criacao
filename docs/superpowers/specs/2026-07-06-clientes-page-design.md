# Página "Clientes" — design

## Objetivo

Nova página `/clientes` com os mesmos gráficos "Tarefas por Prazo" e "Calendário de
Calor" que hoje existem por núcleo em `TimelinePage.tsx`, mas agregados por cliente
(`ClientDisplayName`). Só aparecem clientes com pelo menos uma tarefa aberta.

Escopo considerado: apenas tarefas da área Criação — mesmo filtro que o resto do app
já aplica (`getNucleoByLogin(OwnerUserLogin) !== null`), ou seja, tarefas cujo
responsável está mapeado em algum núcleo em `NUCLEO_MEMBERS`. Tarefas de outras áreas
(sem owner mapeado) são ignoradas, igual já acontece hoje no cálculo de núcleos.

Fora de escopo: "Carga de Trabalho" (workload/capacidade) não se aplica por cliente —
essa métrica depende de cargo/capacidade da equipe, não do cliente. KPIs de topo da
Dashboard também não são replicados aqui.

## Dados

### `src/hooks/useClienteData.ts` (novo)

Espelha `useNucleoData` (`src/hooks/useNucleoData.ts`), reaproveitando `getBucket` de
lá, mas:

- Filtra `openTasks` mantendo só tarefas com `getNucleoByLogin(t.OwnerUserLogin) !== null`.
- Agrupa por `t.ClientDisplayName` (fallback `'Sem cliente'` se vazio) em vez de por
  núcleo fixo — a lista de clientes é construída dinamicamente a partir das tarefas
  encontradas, então clientes sem tarefa aberta nunca geram entrada (sem necessidade de
  filtro extra de "esconder vazios").
- Ordena o resultado alfabeticamente por nome do cliente (`localeCompare` com locale
  `pt-BR`).
- Cor por cliente: função nova `getColorForString(s: string): string` em
  `src/lib/constants.ts` — hash simples da string → hue estável → `hsl(hue, 70%, 60%)`.
  Determinística (mesmo nome sempre gera mesma cor), sem mapa manual.
- **Não** calcula `workload` (sem cargo/capacidade por cliente).

```ts
export interface ClienteStats {
  nome: string;
  cor: string;
  total: number;
  atrasado: number;
  hoje: number;
  semana: number;
  quinzena: number;
  mes: number;
  depois: number;
  tasks: TaskrowTask[];
  byDay: Record<string, number>;
}

export function useClienteData(openTasks: TaskrowTask[]): ClienteStats[]
```

`ClienteStats` tem o mesmo formato estrutural que a parte de `NucleoStats` usada pelos
gráficos (`nome`, `cor`, os 6 buckets, `tasks`, `byDay`), então os componentes de UI
abaixo aceitam ambos via um tipo estrutural comum (`BucketEntity`), sem acoplar a
núcleo.

## Refatoração de UI compartilhada

Hoje `TimelinePage.tsx` tem "Tarefas por Prazo" e "Calendário de Calor" embutidos e
amarrados a `NucleoStats[]`. Para não duplicar essa lógica (~150 linhas incluindo grid,
tooltip, escala de cor) na página nova, extrair:

### `src/lib/charts.ts` (novo)

Move de `TimelinePage.tsx`: `heatColor`, `HEAT_STEPS`, `heatLevelColor`, `BucketEntity`
(interface estrutural com os campos citados acima), `DayInfo`, `buildDays`.

### `src/components/TarefasPorPrazoGrid.tsx` (novo)

Move `BUCKETS` (config dos 6 buckets: atrasado/hoje/semana/quinzena/mes/depois — label
+ cor) e o componente `BucketCard` de `TimelinePage.tsx`. Exporta:

```ts
export default function TarefasPorPrazoGrid({ entities }: { entities: BucketEntity[] })
```

Renderiza o título "Tarefas por Prazo" + grid `grid-cols-1 lg:grid-cols-2` com um
`BucketCard` por bucket, cada um listando uma linha por `entity` (nome truncado + barra
+ contagem), igual ao comportamento atual.

### `src/components/HeatmapCalendar.tsx` (novo)

Move o estado de `showWeekends`/`tooltip`, `buildDays`, e todo o JSX da seção
"Calendário de Calor" (grid de dias × entidades, células clicáveis, tooltip flutuante,
legenda de intensidade). Exporta:

```ts
export default function HeatmapCalendar({
  entities, rowLabel,
}: { entities: BucketEntity[]; rowLabel: string })
```

`rowLabel` parametriza o texto do cabeçalho da primeira coluna (hoje fixo em
"Núcleo") — a página de clientes passa `"Cliente"`.

Comportamento interno (clique em célula abre tooltip com lista de tarefas daquele dia,
toggle de fins de semana, escala de cor por intensidade relativa ao `maxCount` do
próprio conjunto de `entities`) permanece idêntico ao atual, só que `maxCount` e
`getTasksForDay` passam a operar sobre `entities` genérico.

### `TimelinePage.tsx` (editado)

Remove o código movido; passa a importar e usar `<TarefasPorPrazoGrid entities={nucleos} />`
e `<HeatmapCalendar entities={nucleos} rowLabel="Núcleo" />` no lugar das seções
inline. Sem mudança visual ou de comportamento — é refatoração pura.

## Página nova

### `src/pages/ClientesPage.tsx` (novo)

Estrutura análoga a `SwimlanePage.tsx`/`TimelinePage.tsx`: usa `useTaskrowData()` +
`useClienteData(data?.openTasks ?? [])`, com estados de loading (skeleton) e erro
idênticos ao padrão já usado nas outras páginas.

```
<h2>Clientes</h2>
<p>subtítulo</p>

<TarefasPorPrazoGrid entities={clientes} />
<HeatmapCalendar entities={clientes} rowLabel="Cliente" />
```

### Roteamento e navegação

- `src/App.tsx`: nova rota `<Route path="/clientes" element={<ClientesPage />} />`.
- `src/components/Layout.tsx`: novo item no array `NAV` — `{ to: '/clientes', label: 'Clientes', icon: Users }` (ícone `Users` de `lucide-react`), posicionado depois de "Tarefas".

## Tratamento de erro / estados vazios

- Loading/erro: mesmo padrão skeleton/mensagem de erro das outras páginas.
- Se não houver nenhum cliente com tarefa aberta (ex: filtro de área Criação zera
  tudo), `TarefasPorPrazoGrid`/`HeatmapCalendar` recebem `entities=[]` — os `BucketCard`
  mostram total 0 e nenhuma barra; o calendário mostra a grade de dias sem nenhuma
  linha. Não é um caso esperado na prática, mas não quebra.

## Testes / verificação

Não há suite de testes no projeto (`CLAUDE.md`). Verificação via:
- `bun run build` (typecheck) e `bun run lint` depois da refatoração e da página nova.
- Conferência visual: dev server com dados reais do Taskrow, comparando
  `TimelinePage.tsx` antes/depois da refatoração (deve ficar pixel-idêntico) e a nova
  página `/clientes` (grupos por cliente, sem clientes vazios, cores estáveis por
  cliente).
