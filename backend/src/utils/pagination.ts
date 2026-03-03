export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function getPagination(query: Record<string, string | undefined>): PaginationParams {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginate<T>(rows: T[], total: number, page: number, limit: number) {
  return {
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}
