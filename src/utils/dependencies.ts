/**
 * Dependency graph utilities: hierarchy helpers, validation (self / circular /
 * impossible ancestor-descendant links) and topological ordering.
 */

import type { ID, Task } from '../types';

export function buildChildMap(tasks: Task[]): Map<ID, Task[]> {
  const map = new Map<ID, Task[]>();
  for (const t of tasks) {
    if (t.parentId) {
      const list = map.get(t.parentId);
      if (list) list.push(t);
      else map.set(t.parentId, [t]);
    }
  }
  return map;
}

export function hasChildren(tasks: Task[], id: ID): boolean {
  return tasks.some((t) => t.parentId === id);
}

export function childrenOf(tasks: Task[], parentId: ID | null): Task[] {
  return tasks.filter((t) => t.parentId === parentId);
}

/** True when `ancestorId` is a strict ancestor of `taskId`. */
export function isAncestor(tasks: Task[], ancestorId: ID, taskId: ID): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let cur = byId.get(taskId);
  let guard = 0;
  while (cur && cur.parentId && guard++ < 500) {
    if (cur.parentId === ancestorId) return true;
    cur = byId.get(cur.parentId);
  }
  return false;
}

export function descendantsOf(tasks: Task[], id: ID): ID[] {
  const out: ID[] = [];
  const stack: ID[] = [id];
  let guard = 0;
  while (stack.length && guard++ < 10000) {
    const cur = stack.pop() as ID;
    for (const t of tasks) {
      if (t.parentId === cur) {
        out.push(t.id);
        stack.push(t.id);
      }
    }
  }
  return out;
}

export function dependentsOf(tasks: Task[], id: ID): Task[] {
  return tasks.filter((t) => t.dependencies.some((d) => d.predecessorId === id));
}

/**
 * The set of tasks whose dates may need recomputation when the given tasks
 * change: the seeds themselves plus everything reachable through dependency links.
 */
export function collectAffected(tasks: Task[], seedIds: ID[]): Set<ID> {
  const affected = new Set<ID>(seedIds);
  const queue = [...seedIds];
  let guard = 0;
  while (queue.length && guard++ < 10000) {
    const cur = queue.shift() as ID;
    for (const t of tasks) {
      if (affected.has(t.id)) continue;
      if (t.dependencies.some((d) => d.predecessorId === cur)) {
        affected.add(t.id);
        queue.push(t.id);
      }
    }
  }
  return affected;
}

/**
 * Kahn topological order over dependency links (predecessor -> successor) plus
 * virtual subtask -> parent links so children always come before their parent.
 * Nodes caught in a cycle (which validation prevents) are appended at the end.
 */
export function topologicalOrder(tasks: Task[]): ID[] {
  const indegree = new Map<ID, number>();
  const edges = new Map<ID, ID[]>(); // from -> tos
  for (const t of tasks) indegree.set(t.id, 0);
  const addEdge = (from: ID, to: ID) => {
    if (!indegree.has(from) || !indegree.has(to)) return;
    if (from === to) return;
    const list = edges.get(from);
    if (list) list.push(to);
    else edges.set(from, [to]);
    indegree.set(to, (indegree.get(to) || 0) + 1);
  };
  for (const t of tasks) {
    for (const dep of t.dependencies) addEdge(dep.predecessorId, t.id);
    if (t.parentId) addEdge(t.id, t.parentId);
  }
  const queue: ID[] = [];
  for (const t of tasks) if ((indegree.get(t.id) || 0) === 0) queue.push(t.id);
  const order: ID[] = [];
  while (queue.length) {
    const id = queue.shift() as ID;
    order.push(id);
    for (const to of edges.get(id) || []) {
      const next = (indegree.get(to) || 0) - 1;
      indegree.set(to, next);
      if (next === 0) queue.push(to);
    }
  }
  const seen = new Set(order);
  for (const t of tasks) if (!seen.has(t.id)) order.push(t.id);
  return order;
}

/** Path (list of ids) from `from` to `to` following dependency links, or null. */
export function dependencyPath(tasks: Task[], from: ID, to: ID): ID[] | null {
  const prev = new Map<ID, ID>();
  const visited = new Set<ID>([from]);
  const queue: ID[] = [from];
  while (queue.length) {
    const cur = queue.shift() as ID;
    if (cur === to) {
      const path = [cur];
      let node = cur;
      while (prev.has(node)) {
        node = prev.get(node) as ID;
        path.push(node);
      }
      return path.reverse();
    }
    for (const t of tasks) {
      if (visited.has(t.id)) continue;
      if (t.dependencies.some((d) => d.predecessorId === cur)) {
        visited.add(t.id);
        prev.set(t.id, cur);
        queue.push(t.id);
      }
    }
  }
  return null;
}

/**
 * Validates adding `predecessorId -> successorId`.
 * Returns an error message, or null when the link is valid.
 * Pass `{ existing: true }` when auditing a link that is already part of the
 * graph (seed/state validation): the duplicate check is skipped for that link
 * while cycle, hierarchy and summary rules are still enforced.
 */
export function validateDependency(
  tasks: Task[],
  predecessorId: ID,
  successorId: ID,
  opts: { existing?: boolean } = {},
): string | null {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const pred = byId.get(predecessorId);
  const succ = byId.get(successorId);

  if (!pred || !succ) return 'Unknown task selected.';
  if (predecessorId === successorId) return 'A task cannot depend on itself.';

  if (pred.parentId === successorId) {
    return `Impossible ancestor/descendant dependency: "${succ.name}" is a parent of "${pred.name}".`;
  }
  if (succ.parentId === predecessorId) {
    return `Impossible ancestor/descendant dependency: "${pred.name}" is a parent of "${succ.name}".`;
  }
  if (isAncestor(tasks, predecessorId, successorId)) {
    return `Impossible ancestor/descendant dependency: "${pred.name}" is an ancestor of "${succ.name}".`;
  }
  if (isAncestor(tasks, successorId, predecessorId)) {
    return `Impossible ancestor/descendant dependency: "${succ.name}" is an ancestor of "${pred.name}".`;
  }
  if (hasChildren(tasks, predecessorId)) {
    return `Dependencies cannot be set on summary tasks: "${pred.name}" has subtasks, its dates are derived from them.`;
  }
  if (hasChildren(tasks, successorId)) {
    return `Dependencies cannot be set on summary tasks: "${succ.name}" has subtasks, its dates are derived from them.`;
  }
  if (!opts.existing && succ.dependencies.some((d) => d.predecessorId === predecessorId)) {
    return `"${succ.name}" already depends on "${pred.name}".`;
  }

  const cyclePath = dependencyPath(tasks, successorId, predecessorId);
  if (cyclePath) {
    const names = cyclePath.map((id) => byId.get(id)?.name || id);
    names.push(pred.name);
    return `This would create a circular dependency: ${names.join(' -> ')}.`;
  }
  return null;
}
