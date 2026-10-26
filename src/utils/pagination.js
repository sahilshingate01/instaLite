const isPositiveInteger = (val) => {
  if (typeof val !== "string") return false;
  return /^[1-9]\d*$/.test(val);
};

const parsePagination = (query) => {
  let page = 1;
  let limit = 10;

  if (query.page !== undefined) {
    if (!isPositiveInteger(query.page)) {
      return { error: "page and limit must be positive integers" };
    }
    page = parseInt(query.page, 10);
  }

  if (query.limit !== undefined) {
    if (!isPositiveInteger(query.limit)) {
      return { error: "page and limit must be positive integers" };
    }
    limit = parseInt(query.limit, 10);
    if (limit > 50) {
      limit = 50;
    }
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const formatPaginationMeta = (total, page, limit) => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
  };
};

module.exports = {
  isPositiveInteger,
  parsePagination,
  formatPaginationMeta,
};
