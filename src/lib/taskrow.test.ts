import { describe, test, expect } from 'bun:test';
import { buildTaskrowPath } from './taskrow';

describe('buildTaskrowPath', () => {
  test('builds a bare path with no query string when params is empty', () => {
    expect(buildTaskrowPath('v1/User/ListUsers', {})).toBe('/api/v1/User/ListUsers');
  });

  test('appends a query string built from params', () => {
    expect(
      buildTaskrowPath('v2/tasks/taskPanel/listTasks', { sorting: 'Deliverable', nextToken: 'WzEwMF0' })
    ).toBe('/api/v2/tasks/taskPanel/listTasks?sorting=Deliverable&nextToken=WzEwMF0');
  });
});
