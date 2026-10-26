const {
  createUser,
  listUsers,
  getUserById,
  getUserPosts,
  getUserLikedPosts,
  updateUser,
  deleteUser,
} = require("../services/users.service");
const {
  parsePagination,
  formatPaginationMeta,
} = require("../utils/pagination");

const create = async (req, res) => {
  try {
    const { username, email, fullname, bio } = req.body || {};
    if (!username || !email || !fullname) {
      return res
        .status(400)
        .json({ error: "username, email and fullname are required" });
    }

    const userData = { username, email, fullname };
    if (bio !== undefined) {
      userData.bio = bio;
    }

    const result = await createUser(userData);
    res.status(201).json(result);
  } catch (err) {
    res.status(409).json({ error: "username or email already taken" });
  }
};

const list = async (req, res) => {
  const pagination = parsePagination(req.query);
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }
  const { page, limit, skip } = pagination;

  const allowedSortBy = ["createdAt", "username", "fullname"];
  let sortBy = "createdAt";
  if (req.query.sortBy !== undefined) {
    if (!allowedSortBy.includes(req.query.sortBy)) {
      return res
        .status(400)
        .json({ error: "sortBy must be one of: createdAt, username, fullname" });
    }
    sortBy = req.query.sortBy;
  }

  const allowedOrder = ["asc", "desc"];
  let order = "desc";
  if (req.query.order !== undefined) {
    if (!allowedOrder.includes(req.query.order)) {
      return res.status(400).json({ error: "order must be asc or desc" });
    }
    order = req.query.order;
  }

  if (req.query.isPrivate !== undefined) {
    if (req.query.isPrivate !== "true" && req.query.isPrivate !== "false") {
      return res.status(400).json({ error: "isPrivate must be true or false" });
    }
  }

  if (req.query.hasPosts !== undefined) {
    if (req.query.hasPosts !== "true" && req.query.hasPosts !== "false") {
      return res.status(400).json({ error: "hasPosts must be true or false" });
    }
  }

  const where = {};
  if (req.query.isPrivate !== undefined) {
    where.isPrivate = req.query.isPrivate === "true";
  }

  if (req.query.hasPosts !== undefined) {
    where.posts = req.query.hasPosts === "true" ? { some: {} } : { none: {} };
  }

  if (req.query.search) {
    where.OR = [
      { username: { contains: req.query.search, mode: "insensitive" } },
      { fullname: { contains: req.query.search, mode: "insensitive" } },
    ];
  }

  const { data, total } = await listUsers({
    skip,
    take: limit,
    orderBy: { [sortBy]: order },
    where,
  });

  res.json({
    data,
    meta: formatPaginationMeta(total, page, limit),
  });
};

const getOne = async (req, res) => {
  const user = await getUserById(Number(req.params.id));

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
};

const getPosts = async (req, res) => {
  const userId = Number(req.params.id);
  const user = await getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const pagination = parsePagination(req.query);
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }

  const { page, limit, skip } = pagination;
  const { data, total } = await getUserPosts(userId, { skip, take: limit });

  res.json({
    data,
    meta: formatPaginationMeta(total, page, limit),
  });
};

const getLikedPosts = async (req, res) => {
  const userId = Number(req.params.id);
  const user = await getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const pagination = parsePagination(req.query);
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }

  const { page, limit, skip } = pagination;
  const { data, total } = await getUserLikedPosts(userId, { skip, take: limit });

  res.json({
    data,
    meta: formatPaginationMeta(total, page, limit),
  });
};

const update = async (req, res) => {
  try {
    const data = {};
    if (req.body && req.body.fullname !== undefined) data.fullname = req.body.fullname;
    if (req.body && req.body.bio !== undefined) data.bio = req.body.bio;
    if (req.body && req.body.isPrivate !== undefined) data.isPrivate = req.body.isPrivate;

    const updatedUser = await updateUser(Number(req.params.id), data);
    res.json(updatedUser);
  } catch (err) {
    res.status(404).json({ error: "User not found" });
  }
};

const remove = async (req, res) => {
  try {
    await deleteUser(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    res.status(404).json({ error: "User not found" });
  }
};

module.exports = {
  create,
  list,
  getOne,
  getPosts,
  getLikedPosts,
  update,
  remove,
};
