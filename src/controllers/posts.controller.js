const {
  createPost,
  listPosts,
  getPostById,
  updatePost,
  deletePost,
} = require("../services/posts.service");

const create = async (req, res) => {
  try {
    const { imageUrl, authorId, caption, location } = req.body || {};
    if (!imageUrl || authorId === undefined || authorId === null) {
      return res
        .status(400)
        .json({ error: "imageUrl and authorId are required" });
    }

    const postData = {
      imageUrl,
      authorId: Number(authorId),
    };
    if (caption !== undefined) {
      postData.caption = caption;
    }
    if (location !== undefined) {
      postData.location = location;
    }

    const result = await createPost(postData);
    res.status(201).json(result);
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(500).json({ error: "Something went wrong" });
  }
};

const isValidDate = (val) => {
  if (typeof val !== "string" || !val.trim()) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
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

  const allowedSortBy = ["createdAt", "updatedAt"];
  let sortBy = "createdAt";
  if (req.query.sortBy !== undefined) {
    if (!allowedSortBy.includes(req.query.sortBy)) {
      return res
        .status(400)
        .json({ error: "sortBy must be one of: createdAt, updatedAt" });
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

  if (req.query.from !== undefined) {
    if (!isValidDate(req.query.from)) {
      return res
        .status(400)
        .json({ error: "from and to must be valid dates" });
    }
  }

  if (req.query.to !== undefined) {
    if (!isValidDate(req.query.to)) {
      return res
        .status(400)
        .json({ error: "from and to must be valid dates" });
    }
  }

  const where = {};

  if (req.query.location !== undefined && req.query.location !== "") {
    where.location = {
      equals: req.query.location,
      mode: "insensitive",
    };
  }

  if (req.query.search !== undefined && req.query.search !== "") {
    where.caption = {
      contains: req.query.search,
      mode: "insensitive",
    };
  }

  if (req.query.from !== undefined || req.query.to !== undefined) {
    where.createdAt = {};
    if (req.query.from !== undefined) {
      where.createdAt.gte = new Date(req.query.from);
    }
    if (req.query.to !== undefined) {
      where.createdAt.lt = new Date(req.query.to);
    }
  }

  const { data, total } = await listPosts({
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
  const post = await getPostById(Number(req.params.id));
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }
  res.json(post);
};

const update = async (req, res) => {
  try {
    const data = {};
    if (req.body && req.body.caption !== undefined) data.caption = req.body.caption;
    if (req.body && req.body.location !== undefined) data.location = req.body.location;

    const updatedPost = await updatePost(Number(req.params.id), data);
    res.json(updatedPost);
  } catch (err) {
    res.status(404).json({ error: "Post not found" });
  }
};

const remove = async (req, res) => {
  try {
    await deletePost(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    res.status(404).json({ error: "Post not found" });
  }
};

module.exports = {
  create,
  list,
  getOne,
  update,
  remove,
};
