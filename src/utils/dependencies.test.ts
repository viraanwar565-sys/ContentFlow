import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import {
  descendantsOf,
  topologicalOrder,
  validateDependency,
} from './dependencies';

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: 'p1',
    contentItemId: null,
    parentId: null,
    name: `Task ${id}`,
    startDate: '2026-01-05',
    duration: 2,
    status: 'Not Started',
    priority: 'Medium',
    progress: 0,
    assigneeId: null,
    isMilestone: false,
    dependencies: [],
    ...overrides,
  };
}

/** a (parent) -> b (child of a), c, d (child of c) */
function fixture(): Task[] {
  return [
    makeTask('a'),
    makeTask('b', { parentId: 'a' }),
    makeTask('c'),
    makeTask('d', { parentId: 'c' }),
    makeTask('e'),
  ];
}

describe('dependency validation', () => {
  it('rejects self dependencies', () => {
    const err = validateDependency(fixture(), 'e', 'e');
    expect(err).toContain('itself');
  });

  it('rejects ancestor/descendant (parent -> child) links', () => {
    expect(validateDependency(fixture(), 'a', 'b')).toMatch(/ancestor\/descendant/i);
    expect(validateDependency(fixture(), 'b', 'a')).toMatch(/ancestor\/descendant/i);
  });

  it('rejects dependencies involving summary tasks', () => {
    const err = validateDependency(fixture(), 'a', 'e');
    expect(err).toMatch(/summary/i);
    expect(validateDependency(fixture(), 'e', 'c')).toMatch(/summary/i);
  });

  it('rejects duplicate links', () => {
    const tasks = [
      makeTask('x'),
      makeTask('y', { dependencies: [{ predecessorId: 'x', type: 'FS', lag: 0 }] }),
    ];
    expect(validateDependency(tasks, 'x', 'y')).toMatch(/already depends/i);
  });

  it('rejects direct cycles', () => {
    const tasks = [
      makeTask('x', { dependencies: [{ predecessorId: 'y', type: 'FS', lag: 0 }] }),
      makeTask('y'),
    ];
    // adding y -> x would close the loop
    const err = validateDependency(tasks, 'y', 'x');
    expect(err).toMatch(/circular/i);
  });

  it('rejects longer cycles', () => {
    const tasks = [
      makeTask('x'),
      makeTask('y', { dependencies: [{ predecessorId: 'x', type: 'FS', lag: 0 }] }),
      makeTask('z', { dependencies: [{ predecessorId: 'y', type: 'FS', lag: 0 }] }),
    ];
    // adding x <- z (x depends on z) closes x -> y -> z -> x
    const err = validateDependency(tasks, 'z', 'x');
    expect(err).toMatch(/circular/i);
    expect(err).toContain('x');
  });

  it('accepts valid leaf-to-leaf links', () => {
    expect(validateDependency(fixture(), 'e', 'b')).toBeNull();
    expect(validateDependency(fixture(), 'e', 'd')).toBeNull();
  });

  it('reports unknown tasks', () => {
    expect(validateDependency(fixture(), 'missing', 'e')).toMatch(/unknown/i);
  });
});

describe('hierarchy helpers', () => {
  it('lists descendants', () => {
    expect(descendantsOf(fixture(), 'a').sort()).toEqual(['b']);
    expect(descendantsOf(fixture(), 'c').sort()).toEqual(['d']);
    expect(descendantsOf(fixture(), 'e')).toEqual([]);
  });
});

describe('topological order', () => {
  it('orders predecessors before successors and children before parents', () => {
    const tasks = [
      makeTask('x'),
      makeTask('y', { dependencies: [{ predecessorId: 'x', type: 'FS', lag: 0 }] }),
      makeTask('parent'),
      makeTask('child', { parentId: 'parent' }),
    ];
    const order = topologicalOrder(tasks);
    expect(order.indexOf('x')).toBeLessThan(order.indexOf('y'));
    expect(order.indexOf('child')).toBeLessThan(order.indexOf('parent'));
  });

  it('keeps every task exactly once', () => {
    const order = topologicalOrder(fixture());
    expect(new Set(order).size).toBe(fixture().length);
  });
});
