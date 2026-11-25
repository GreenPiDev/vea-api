import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { containsSearch, pageArgs, paginate } from './paginate';
import { MAX_PAGE_SIZE, PagedQueryDto } from './paged-query.dto';

describe('pageArgs', () => {
  it('turns a 1-based page into skip/take', () => {
    expect(pageArgs({ page: 1, pageSize: 20 })).toEqual({ skip: 0, take: 20 });
    expect(pageArgs({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
  });
});

describe('paginate', () => {
  it('runs the query with the page args and wraps items + total', async () => {
    const run = jest.fn().mockResolvedValue([['a', 'b'], 42]);
    await expect(paginate({ page: 2, pageSize: 2 }, run)).resolves.toEqual({
      items: ['a', 'b'],
      total: 42,
      page: 2,
      pageSize: 2,
    });
    expect(run).toHaveBeenCalledWith({ skip: 2, take: 2 });
  });
});

describe('containsSearch', () => {
  it('builds a case-insensitive OR over the given fields', () => {
    expect(
      containsSearch('ali', (c) => [{ email: c }, { profile: { name: c } }]),
    ).toEqual({
      OR: [
        { email: { contains: 'ali', mode: 'insensitive' } },
        { profile: { name: { contains: 'ali', mode: 'insensitive' } } },
      ],
    });
  });

  it('adds nothing when there is no (or only whitespace) search', () => {
    const build = jest.fn();
    expect(containsSearch(undefined, build)).toEqual({});
    expect(containsSearch('   ', build)).toEqual({});
    expect(build).not.toHaveBeenCalled();
  });
});

describe('PagedQueryDto', () => {
  const parse = (plain: Record<string, unknown>) => {
    const dto = plainToInstance(PagedQueryDto, plain);
    return { dto, errors: validateSync(dto) };
  };

  it('defaults to page 1, 20 per page', () => {
    const { dto, errors } = parse({});
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
  });

  it('parses query-string numbers', () => {
    const { dto, errors } = parse({ page: '3', pageSize: '50' });
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.pageSize).toBe(50);
  });

  it(`rejects page < 1 and pageSize > ${MAX_PAGE_SIZE}`, () => {
    expect(parse({ page: '0' }).errors).not.toHaveLength(0);
    expect(
      parse({ pageSize: String(MAX_PAGE_SIZE + 1) }).errors,
    ).not.toHaveLength(0);
  });

  it('trims the search term and treats blank as no search', () => {
    expect(parse({ search: '  ayşe  ' }).dto.search).toBe('ayşe');
    expect(parse({ search: '   ' }).dto.search).toBeUndefined();
  });

  it('rejects an overly long search term', () => {
    expect(parse({ search: 'x'.repeat(101) }).errors).not.toHaveLength(0);
  });
});
