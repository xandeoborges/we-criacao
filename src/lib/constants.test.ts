import { describe, test, expect } from 'bun:test';
import { buildNucleoDirectory, getNucleoByLogin, getCargoWeight } from './constants';
import type { TaskrowUser } from './taskrow';

function user(overrides: Partial<TaskrowUser>): TaskrowUser {
  return {
    UserLogin: 'Fulano Silva',
    ApprovalGroup: 'BORBA - DESIGN',
    FunctionGroupName: 'Criação',
    UserFunctionTitle: 'Diretor(a) de Arte Pleno',
    ...overrides,
  };
}

describe('buildNucleoDirectory', () => {
  test('groups users by ApprovalGroup within the Criação department', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'Marcos Hosken', ApprovalGroup: 'HOSKEN/LEANDRO' }),
      user({ UserLogin: 'Andrew Sousa', ApprovalGroup: 'BORBA - DESIGN' }),
    ]);
    expect(dir.order).toEqual(['BORBA - DESIGN', 'HOSKEN/LEANDRO']);
    expect(dir.membersByNucleo['BORBA - DESIGN']).toEqual(['andrew sousa']);
  });

  test('excludes users outside the Criação department', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'Almir Pereira', FunctionGroupName: 'Mídia', ApprovalGroup: 'ALMIR' }),
    ]);
    expect(dir.order).toEqual([]);
  });

  test('excludes the bare CRIAÇÃO leadership approval group', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'Armando Araujo', ApprovalGroup: 'CRIAÇÃO' }),
    ]);
    expect(dir.order).toEqual([]);
  });

  test('assigns a color to every discovered núcleo', () => {
    const dir = buildNucleoDirectory([user({ UserLogin: 'Andrew Sousa', ApprovalGroup: 'BORBA - DESIGN' })]);
    expect(typeof dir.colors['BORBA - DESIGN']).toBe('string');
    expect(dir.colors['BORBA - DESIGN'].length).toBeGreaterThan(0);
  });

  test('captures cargo for every user, even outside Criação', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'Almir Pereira', FunctionGroupName: 'Mídia', ApprovalGroup: 'ALMIR', UserFunctionTitle: 'Gerente de Mídia' }),
    ]);
    expect(dir.cargoByLogin['almir pereira']).toBe('Gerente de Mídia');
  });
});

describe('getNucleoByLogin', () => {
  test('matches ignoring case and accents', () => {
    const dir = buildNucleoDirectory([user({ UserLogin: 'André Souza', ApprovalGroup: 'BORBA - DESIGN' })]);
    expect(getNucleoByLogin('ANDRÉ SOUZA', dir)).toBe('BORBA - DESIGN');
    expect(getNucleoByLogin('andre souza', dir)).toBe('BORBA - DESIGN');
  });

  test('returns null for a login with no núcleo', () => {
    const dir = buildNucleoDirectory([]);
    expect(getNucleoByLogin('ninguem', dir)).toBeNull();
  });
});

describe('getCargoWeight', () => {
  test('maps seniority keywords in the cargo title to weights', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'A', UserFunctionTitle: 'Diretor(a) de Arte Sênior' }),
      user({ UserLogin: 'B', UserFunctionTitle: 'Redator(a) Junior' }),
      user({ UserLogin: 'C', UserFunctionTitle: 'Assistente de Arte' }),
    ]);
    expect(getCargoWeight('A', dir)).toBe(1.25);
    expect(getCargoWeight('B', dir)).toBe(0.75);
    expect(getCargoWeight('C', dir)).toBe(0.5);
  });

  test('falls back to the default (Pleno) weight for an unknown login', () => {
    const dir = buildNucleoDirectory([]);
    expect(getCargoWeight('ninguem', dir)).toBe(1.0);
  });
});
