import { describe, test, expect } from 'bun:test';
import { buildNucleoDirectory, getNucleoByLogin, getCargoWeight } from './constants';
import type { TaskrowUser, TaskrowGroup } from './taskrow';

function user(overrides: Partial<TaskrowUser>): TaskrowUser {
  return {
    UserLogin: 'Fulano Silva',
    FunctionGroupName: 'Criação',
    UserFunctionTitle: 'Diretor(a) de Arte Pleno',
    ...overrides,
  };
}

function group(overrides: Partial<TaskrowGroup> & { GroupName: string }): TaskrowGroup {
  return { Members: [], Groups: [], ...overrides };
}

describe('buildNucleoDirectory', () => {
  test('groups users by their approval-group membership within the Criação department', () => {
    const dir = buildNucleoDirectory(
      [user({ UserLogin: 'Marcos Hosken' }), user({ UserLogin: 'Andrew Sousa' })],
      [
        group({ GroupName: 'HOSKEN/LEANDRO', Members: ['Marcos Hosken'] }),
        group({ GroupName: 'BORBA - DESIGN', Members: ['Andrew Sousa'] }),
      ]
    );
    expect(dir.order).toEqual(['BORBA - DESIGN', 'HOSKEN/LEANDRO']);
    expect(dir.membersByNucleo['BORBA - DESIGN']).toEqual(['andrew sousa']);
  });

  test('excludes users outside the Criação department', () => {
    const dir = buildNucleoDirectory(
      [user({ UserLogin: 'Almir Pereira', FunctionGroupName: 'Mídia' })],
      [group({ GroupName: 'ALMIR', Members: ['Almir Pereira'] })]
    );
    expect(dir.order).toEqual([]);
  });

  test('excludes the bare CRIAÇÃO leadership approval group', () => {
    const dir = buildNucleoDirectory(
      [user({ UserLogin: 'Armando Araujo' })],
      [group({ GroupName: 'CRIAÇÃO', Members: ['Armando Araujo'] })]
    );
    expect(dir.order).toEqual([]);
  });

  test('excludes CONTEÚDO, KLEYTON and OPERAÇÕES approval groups', () => {
    const dir = buildNucleoDirectory(
      [
        user({ UserLogin: 'Arthur Borel' }),
        user({ UserLogin: 'Kleyton Mourão' }),
        user({ UserLogin: 'Caio Cocozza' }),
      ],
      [
        group({ GroupName: 'CONTEÚDO', Members: ['Arthur Borel'] }),
        group({ GroupName: 'KLEYTON', Members: ['Kleyton Mourão'] }),
        group({ GroupName: 'OPERAÇÕES', Members: ['Caio Cocozza'] }),
      ]
    );
    expect(dir.order).toEqual([]);
  });

  test('resolves núcleo from nested subgroups, ignoring intermediate leadership groups in the tree', () => {
    // Reproduz a hierarquia real do Taskrow: CRIAÇÃO > KLEYTON > BRASIL/MURILO (núcleo de verdade).
    const dir = buildNucleoDirectory(
      [user({ UserLogin: 'Bruno Brasil' }), user({ UserLogin: 'Claudio Eiji' })],
      [
        group({
          GroupName: 'CRIAÇÃO',
          Groups: [
            group({
              GroupName: 'KLEYTON',
              Groups: [
                group({ GroupName: 'BRASIL/MURILO', Members: ['Bruno Brasil', 'Claudio Eiji'] }),
              ],
            }),
          ],
        }),
      ]
    );
    expect(dir.order).toEqual(['BRASIL/MURILO']);
    expect(dir.membersByNucleo['BRASIL/MURILO']).toEqual(['bruno brasil', 'claudio eiji']);
  });

  test('assigns a color to every discovered núcleo', () => {
    const dir = buildNucleoDirectory(
      [user({ UserLogin: 'Andrew Sousa' })],
      [group({ GroupName: 'BORBA - DESIGN', Members: ['Andrew Sousa'] })]
    );
    expect(typeof dir.colors['BORBA - DESIGN']).toBe('string');
    expect(dir.colors['BORBA - DESIGN'].length).toBeGreaterThan(0);
  });

  test('captures cargo for every user, even outside Criação', () => {
    const dir = buildNucleoDirectory(
      [user({ UserLogin: 'Almir Pereira', FunctionGroupName: 'Mídia', UserFunctionTitle: 'Gerente de Mídia' })],
      []
    );
    expect(dir.cargoByLogin['almir pereira']).toBe('Gerente de Mídia');
  });
});

describe('getNucleoByLogin', () => {
  test('matches ignoring case and accents', () => {
    const dir = buildNucleoDirectory(
      [user({ UserLogin: 'André Souza' })],
      [group({ GroupName: 'BORBA - DESIGN', Members: ['André Souza'] })]
    );
    expect(getNucleoByLogin('ANDRÉ SOUZA', dir)).toBe('BORBA - DESIGN');
    expect(getNucleoByLogin('andre souza', dir)).toBe('BORBA - DESIGN');
  });

  test('returns null for a login with no núcleo', () => {
    const dir = buildNucleoDirectory([], []);
    expect(getNucleoByLogin('ninguem', dir)).toBeNull();
  });
});

describe('getCargoWeight', () => {
  test('maps seniority keywords in the cargo title to weights', () => {
    const dir = buildNucleoDirectory(
      [
        user({ UserLogin: 'A', UserFunctionTitle: 'Diretor(a) de Arte Sênior' }),
        user({ UserLogin: 'B', UserFunctionTitle: 'Redator(a) Junior' }),
        user({ UserLogin: 'C', UserFunctionTitle: 'Assistente de Arte' }),
      ],
      []
    );
    expect(getCargoWeight('A', dir)).toBe(1.25);
    expect(getCargoWeight('B', dir)).toBe(0.75);
    expect(getCargoWeight('C', dir)).toBe(0.5);
  });

  test('falls back to the default (Pleno) weight for an unknown login', () => {
    const dir = buildNucleoDirectory([], []);
    expect(getCargoWeight('ninguem', dir)).toBe(1.0);
  });
});
