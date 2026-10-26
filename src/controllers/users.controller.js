const {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require("../services/users.service");

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

const isPositiveInteger = (val) => {
  if (typeof val !== "string") return false;
  return /^[1-9]\d*$/.test(val);
};

const list = async (req, res) => {
  let page = 1;
  let limit = 10;

  if (req.query.page !== undefined) {
    if (!isPositiveInteger(req.query.page)) {
      return res
        .status(400)
        .json({ error: "page and limit must be positive integers" });
    }
    page = parseInt(req.query.page, 10);
  }

  if (req.query.limit !== undefined) {
    if (!isPositiveInteger(req.query.limit)) {
      return res
        .status(400)
        .json({ error: "page and limit must be positive integers" });
    }
    limit = parseInt(req.query.limit, 10);
    if (limit > 50) {
      limit = 50;
    }
  }

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

  const where = {};
  if (req.query.isPrivate !== undefined) {
    where.isPrivate = req.query.isPrivate === "true";
  }

  if (req.query.search) {
    where.OR = [
      { username: { contains: req.query.search, mode: "insensitive" } },
      { fullname: { contains: req.query.search, mode: "insensitive" } },
    ];
  }

  const { data, total } = await listUsers({
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { [sortBy]: order },
    where,
  });

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  res.json({
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  });
};

const getOne = async (req, res) => {
  const user = await getUserById(Number(req.params.id));

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
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

module.exports = { create, list, getOne, update, remove };
