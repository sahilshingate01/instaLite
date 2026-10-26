const {
  createPost,
  listPosts,
  getPostById,
  updatePost,
  deletePost,
} = require("../services/posts.service");

const create = async (req, res) => {
  try {
    const { imageUrl, caption, location } = req.body || {};
    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl is required" });
    }

    const postData = { imageUrl };
    if (caption !== undefined) {
      postData.caption = caption;
    }
    if (location !== undefined) {
      postData.location = location;
    }

    const result = await createPost(postData);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
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

  const { data, total } = await listPosts({
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { [sortBy]: order },
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
