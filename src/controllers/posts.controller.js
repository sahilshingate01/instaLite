const {
  createPost,
  listPosts,
  getPostById,
  getPostLikes,
  updatePost,
  deletePost,
} = require("../services/posts.service");
const {
  parsePagination,
  formatPaginationMeta,
} = require("../utils/pagination");

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

const list = async (req, res) => {
  const pagination = parsePagination(req.query);
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }
  const { page, limit, skip } = pagination;

  const allowedSortBy = ["createdAt", "updatedAt", "likes"];
  let sortBy = "createdAt";
  if (req.query.sortBy !== undefined) {
    if (!allowedSortBy.includes(req.query.sortBy)) {
      return res
        .status(400)
        .json({ error: "sortBy must be one of: createdAt, updatedAt, likes" });
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

  const orderBy =
    sortBy === "likes"
      ? [{ likes: { _count: order } }, { createdAt: "desc" }]
      : { [sortBy]: order };

  const { data, total } = await listPosts({
    skip,
    take: limit,
    orderBy,
    where,
  });

  res.json({
    data,
    meta: formatPaginationMeta(total, page, limit),
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

const getLikes = async (req, res) => {
  const postId = Number(req.params.id);
  const likes = await getPostLikes(postId);
  if (!likes) {
    return res.status(404).json({ error: "Post not found" });
  }
  res.json(likes);
};

module.exports = {
  create,
  list,
  getOne,
  getLikes,
  update,
  remove,
};
