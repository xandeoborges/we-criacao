export const NUCLEO_COLORS: Record<string, string> = {
  'BORBA - DESIGN':   '#6C63FF',
  'HOSKEN/LEANDRO':   '#00D4FF',
  'MURILO/RENATA':    '#00E5A0',
  'PA/TAVINHO':       '#FF4D6A',
  'VANESSA/PAULA':    '#FFB800',
  'Criação MIDWAY':   '#FF7A45',
};

export const NUCLEO_ORDER = [
  'BORBA - DESIGN',
  'HOSKEN/LEANDRO',
  'MURILO/RENATA',
  'PA/TAVINHO',
  'VANESSA/PAULA',
  'Criação MIDWAY',
];

// Map: OwnerUserLogin (display name, lowercase) → nucleo
const NUCLEO_MEMBERS: Record<string, string> = {
  // BORBA - DESIGN
  'alexander borba':   'BORBA - DESIGN',
  'andrew sousa':      'BORBA - DESIGN',
  'ivis lopes':        'BORBA - DESIGN',
  'gabriela camargo':  'BORBA - DESIGN',
  'joao marques':      'BORBA - DESIGN',
  'leandro silva':     'BORBA - DESIGN',
  'lucas barone':      'BORBA - DESIGN',
  'luciana varella':   'BORBA - DESIGN',
  'maclei torquato':   'BORBA - DESIGN',
  'marcel zylberman':  'BORBA - DESIGN',
  'thiago lima':       'BORBA - DESIGN',
  // HOSKEN/LEANDRO
  'marcos hosken':     'HOSKEN/LEANDRO',
  'leandro marchiori': 'HOSKEN/LEANDRO',
  'adriano tozin':     'HOSKEN/LEANDRO',
  'danilo cajaiba':    'HOSKEN/LEANDRO',
  'felipe porto':      'HOSKEN/LEANDRO',
  'gabriel augusto':   'HOSKEN/LEANDRO',
  'henrique mendes':   'HOSKEN/LEANDRO',
  'murilo zeneddine':  'HOSKEN/LEANDRO',
  'will viscaino':     'HOSKEN/LEANDRO',
  // MURILO/RENATA
  'murilo torezan':    'MURILO/RENATA',
  'renata antunes':    'MURILO/RENATA',
  'aline lima':        'MURILO/RENATA',
  'bruno belli':       'MURILO/RENATA',
  'fabio porto':       'MURILO/RENATA',
  'joao correia':      'MURILO/RENATA',
  'kika mateos':       'MURILO/RENATA',
  'luisa pacheco':     'MURILO/RENATA',
  'mariana belfort':   'MURILO/RENATA',
  'mayara lucchiari':  'MURILO/RENATA',
  'natalia marretti':  'MURILO/RENATA',
  'walmor mello':      'MURILO/RENATA',
  // PA/TAVINHO
  'otavio mastrogiuseppe': 'PA/TAVINHO',
  'paulo almeida':     'PA/TAVINHO',
  'cristhian rodriguez': 'PA/TAVINHO',
  'danilo oliveira':   'PA/TAVINHO',
  'danilo schiavon':   'PA/TAVINHO',
  'guigo oliva':       'PA/TAVINHO',
  'humberto pacheco':  'PA/TAVINHO',
  'leonardo brito':    'PA/TAVINHO',
  'sibely silveira':   'PA/TAVINHO',
  'weronika santos':   'PA/TAVINHO',
  // VANESSA/PAULA
  'vanessa jansen':    'VANESSA/PAULA',
  'paula esteves':     'VANESSA/PAULA',
  'caio penhalver':    'VANESSA/PAULA',
  'diego oliveira':    'VANESSA/PAULA',
  'flavia coelho':     'VANESSA/PAULA',
  'leticia lourenco':  'VANESSA/PAULA',
  'lucas borges':      'VANESSA/PAULA',
  'rafaela riera':     'VANESSA/PAULA',
  // Criacao MIDWAY
  'camilla gebara':    'Criação MIDWAY',
  'debora cissoto':    'Criação MIDWAY',
  'luisa biondo':      'Criação MIDWAY',
};

export function getNucleoMembers(nucleo: string): string[] {
  return Object.entries(NUCLEO_MEMBERS)
    .filter(([, n]) => n === nucleo)
    .map(([login]) => login);
}

// Cargo (função) de cada pessoa, extraído da lista de usuários do Taskrow (fonte: RH/admin).
// Chave: nome normalizado (mesmo formato usado em NUCLEO_MEMBERS). Usado para estimar
// capacidade de carga de trabalho por núcleo. Pessoas sem entrada aqui usam peso "Pleno" (default).
export const USER_CARGO: Record<string, string> = {
  'adriano tozin':        'Diretor(a) de Arte Pleno',
  'alexander borba':      'Diretor(a) de Criação',
  'aline lima':           'Redator(a) Junior',
  'andrew sousa':         'Diretor(a) de Arte Sênior',
  'bruno belli':          'Diretor(a) de Arte Junior',
  'caio penhalver':       'Redator(a) Pleno',
  'camilla gebara':       'Diretor(a) de Arte Pleno',
  'cristhian rodriguez':  'Diretor(a) de Arte Pleno',
  'danilo cajaiba':       'Diretor(a) de Arte Sênior',
  'danilo oliveira':      'Redator(a) Junior',
  'diego oliveira':       'Diretor(a) de Arte Pleno',
  'felipe porto':         'Diretor(a) de Arte Sênior',
  'flavia coelho':        'Redator(a) Sênior',
  'fabio porto':          'Diretor(a) de Arte Sênior',
  'gabriel augusto':      'Diretor(a) de Arte Pleno',
  'gabriela camargo':     'Redator(a) Pleno',
  'guigo oliva':          'Redator(a) Sênior',
  'henrique mendes':      'Redator(a) Sênior',
  'humberto pacheco':     'Redator(a) Sênior',
  'ivis lopes':           'Diretor(a) de Arte Junior',
  'joao correia':         'Diretor(a) de Arte Pleno',
  'joao marques':         'Assistente de Arte',
  'kika mateos':          'Redator(a) Pleno',
  'leandro marchiori':    'Diretor(a) de Criação',
  'leandro silva':        'Redator(a) Junior',
  'leonardo brito':       'Diretor(a) de Arte Sênior',
  'leticia lourenco':     'Diretor(a) de Arte Sênior',
  'lucas barone':         'Assistente de Arte',
  'lucas borges':         'Assistente de Arte',
  'luciana varella':      'Diretor(a) de Arte Sênior',
  'luisa biondo':         'Redator(a) Junior',
  'luisa pacheco':        'Diretor(a) de Arte Pleno',
  'maclei torquato':      'Diretor(a) de Arte Pleno',
  'marcos hosken':        'Diretor(a) de Criação',
  'mariana belfort':      'Diretor(a) de Arte Junior',
  'mayara lucchiari':     'Diretor(a) de Arte Pleno',
  'murilo torezan':       'Diretor(a) de Criação',
  'murilo zeneddine':     'Redator(a) Pleno',
  'natalia marretti':     'Redator(a) Sênior',
  'otavio mastrogiuseppe':'Diretor(a) de Criação',
  'paula esteves':        'Diretor(a) de Criação',
  'paulo almeida':        'Diretor(a) de Criação',
  'rafaela riera':        'Redator(a) Pleno',
  'renata antunes':       'Diretor(a) de Criação',
  'sibely silveira':      'Diretor(a) de Arte Sênior',
  'thiago lima':          'Diretor(a) de Arte Sênior',
  'vanessa jansen':       'Diretor(a) de Criação',
  'walmor mello':         'Redator(a) Sênior',
  'weronika santos':      'Diretor(a) de Arte Pleno',
  'will viscaino':        'Redator(a) Sênior',
};

// Peso de capacidade por cargo (senioridade como proxy de capacidade de absorver volume/complexidade).
// Ajustável — recalibrar após observar dados reais de algumas semanas.
const CARGO_WEIGHT_BY_LEVEL: [string, number][] = [
  ['assistente', 0.5],
  ['junior',     0.75],
  ['pleno',      1.0],
  ['senior',     1.25],
  ['diretor',    1.5],
];
const DEFAULT_CARGO_WEIGHT = 1.0; // fallback (nível "Pleno") para quem não está em USER_CARGO

export function getCargoWeight(login: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cargo = USER_CARGO[normalize(login)];
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
  media: 2,
  alta: 3,
};
export const DEFAULT_COMPLEXITY_WEIGHT = 2; // tarefa sem tag de complexidade

// Quantos pontos de carga (ponderados por complexidade) uma pessoa de peso 1.0 (Pleno) "aguenta"
// na janela de pressão imediata (atrasado + hoje + esta semana). Ajustável.
export const BASE_TASKS_PER_CAPACITY = 6;

export function getNucleoByLogin(login: string): string | null {
  // Normalize: lowercase, trim, strip diacritics for matching
  const normalize = (s: string) =>
    s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const key = normalize(login);
  // Direct lookup after normalization
  const directKey = login.toLowerCase().trim();
  if (NUCLEO_MEMBERS[directKey]) return NUCLEO_MEMBERS[directKey];
  // Fallback with diacritic stripping
  return NUCLEO_MEMBERS[key] ?? null;
}

export function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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
