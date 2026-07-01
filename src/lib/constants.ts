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
