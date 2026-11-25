// Central helpers for server-side paginated + searchable lists, so every
// list endpoint returns the same shape and builds search the same way.
//
//   const where = { organizationId, ...containsSearch(q.search, (c) => [
//     { title: c }, { curator: { email: c } },
//   ]) };
//   return paginate(q, (page) => this.prisma.$transaction([
//     this.prisma.exhibition.findMany({ where, ...page, orderBy }),
//     this.prisma.exhibition.count({ where }),
//   ]));

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface PageArgs {
  skip: number;
  take: number;
}

export function pageArgs({ page, pageSize }: PageQuery): PageArgs {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Runs the caller's `[items, total]` query (ideally a Prisma $transaction so
 * both see the same snapshot) for the requested page and wraps the result.
 */
export async function paginate<T>(
  query: PageQuery,
  run: (args: PageArgs) => Promise<[T[], number]>,
): Promise<Paginated<T>> {
  const [items, total] = await run(pageArgs(query));
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export interface ContainsFilter {
  contains: string;
  mode: 'insensitive';
}

/**
 * Case-insensitive "contains" search across several fields: returns
 * `{ OR: [...] }` to spread into a Prisma `where`, or `{}` when there's no
 * search term. `build` receives the string filter and places it on each
 * searchable field (nested relations included).
 */
export function containsSearch<W>(
  search: string | undefined,
  build: (contains: ContainsFilter) => W[],
): { OR: W[] } | Record<string, never> {
  const term = search?.trim();
  if (!term) return {};
  return { OR: build({ contains: term, mode: 'insensitive' }) };
}
