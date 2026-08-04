import { describe, test, expect } from 'bun:test';
import { buildTaskrowPath } from './taskrow';

describe('buildTaskrowPath', () => {
  test('builds a bare path with no query string when params is empty', () => {
    expect(buildTaskrowPath('User/ListUsers', {})).toBe('/api/v1/User/ListUsers');
  });

  test('appends a query string built from params', () => {
    expect(
      buildTaskrowPath('Dashboard/TasksByGroup', { groupID: '11947', context: '1' })
    ).toBe('/api/v1/Dashboard/TasksByGroup?groupID=11947&context=1');
  });
});
