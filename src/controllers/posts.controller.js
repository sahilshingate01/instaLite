const {
  createPost,
  listPosts,
  getPostById,
  updatePost,
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

const list = async (req, res) => {
  const result = await listPosts();
  res.json(result);
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

module.exports = {
  create,
  list,
  getOne,
  update,
};
