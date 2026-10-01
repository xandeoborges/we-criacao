import type { TaskrowUser, TaskrowGroup } from '@/lib/taskrow';

export function normalize(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface NucleoDirectory {
  order: string[];
  colors: Record<string, string>;
  membersByNucleo: Record<string, string[]>;
  nucleoByLogin: Record<string, string>;
  cargoByLogin: Record<string, string>;
}

const CRIACAO_DEPARTMENT = 'Criação';
// Grupos de aprovação da Criação que não devem virar núcleo no dashboard:
// 'CRIAÇÃO' e 'KLEYTON' = nós intermediários de liderança na árvore de grupos (CCOs/ECD),
// não são núcleos de verdade; 'CONTEÚDO' e 'OPERAÇÕES' = excluídos a pedido do time.
const EXCLUDED_APPROVAL_GROUPS = new Set(['CRIAÇÃO', 'CONTEÚDO', 'KLEYTON', 'OPERAÇÕES']);

// Achata a árvore de grupos (com subgrupos aninhados) num mapa login → nome do grupo
// direto (o núcleo), usando apenas membros diretos de cada grupo — não inclui os membros
// dos subgrupos no grupo pai.
function flattenGroupMembership(groups: TaskrowGroup[]): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (group: TaskrowGroup) => {
    for (const login of group.Members) {
      const n = normalize(login);
      if (n) result[n] = group.GroupName;
    }
    group.Groups.forEach(walk);
  };
  groups.forEach(walk);
  return result;
}

export function buildNucleoDirectory(users: TaskrowUser[], groups: TaskrowGroup[]): NucleoDirectory {
  const membersByNucleo: Record<string, string[]> = {};
  const nucleoByLogin: Record<string, string> = {};
  const cargoByLogin: Record<string, string> = {};
  const groupByLogin = flattenGroupMembership(groups);

  for (const u of users) {
    const login = normalize(u.UserLogin);
    if (login) cargoByLogin[login] = u.UserFunctionTitle;

    if (u.FunctionGroupName !== CRIACAO_DEPARTMENT) continue;
    if (!login) continue;

    const nucleo = groupByLogin[login];
    if (!nucleo || EXCLUDED_APPROVAL_GROUPS.has(nucleo)) continue;

    if (!membersByNucleo[nucleo]) membersByNucleo[nucleo] = [];
    membersByNucleo[nucleo].push(login);
    nucleoByLogin[login] = nucleo;
  }

  const order = Object.keys(membersByNucleo).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const colors: Record<string, string> = {};
  order.forEach((n) => { colors[n] = getColorForString(n); });

  return { order, colors, membersByNucleo, nucleoByLogin, cargoByLogin };
}

export function getNucleoByLogin(login: string, dir: NucleoDirectory): string | null {
  return dir.nucleoByLogin[normalize(login)] ?? null;
}

const CARGO_WEIGHT_BY_LEVEL: [string, number][] = [
  ['assistente', 0.5],
  ['junior',     0.75],
  ['pleno',      1.0],
  ['senior',     1.25],
  ['diretor',    1.5],
];
const DEFAULT_CARGO_WEIGHT = 1.0; // fallback (nível "Pleno") para quem não tem cargo conhecido

export function getCargoWeight(login: string, dir: NucleoDirectory): number {
  const cargo = dir.cargoByLogin[normalize(login)];
  if (!cargo) return DEFAULT_CARGO_WEIGHT;
  const normalizedCargo = normalize(cargo);
  for (const [level, weight] of CARGO_WEIGHT_BY_LEVEL) {
    if (normalizedCargo.includes(level)) return weight;
  }
  return DEFAULT_CARGO_WEIGHT;
}

// Peso de complexidade por tarefa (tag "BAIXA/MÉDIA/ALTA Complexidade" vinda da API do Taskrow).
export const COMPLEXITY_WEIGHT: Record<'baixa' | 'media' | 'alta', number> = {
  baixa: 1,
  media: 3,
  alta: 5,
};
export const DEFAULT_COMPLEXITY_WEIGHT = 2; // tarefa sem tag de complexidade (peso neutro)

// Quantos pontos de carga (ponderados por complexidade) uma pessoa de peso 1.0 (Pleno) "aguenta"
// em cada janela de tempo. Constantes independentes por janela — ajustáveis livremente.
export const BASE_CAPACITY_BY_WINDOW = {
  hoje: 1,      // atrasado + hoje
  semana: 6,    // atrasado + hoje + próximos 7 dias
  quinzena: 13, // atrasado + hoje + próximos 15 dias
  mes: 20,      // atrasado + hoje + próximos 30 dias
};

// Cor estável por string (hash simples → matiz HSL), usada tanto para núcleos
// (via buildNucleoDirectory) quanto para clientes.
export function getColorForString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

export function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} às ${hh}:${min}`;
}

export function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
