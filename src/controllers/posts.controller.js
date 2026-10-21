const { createPost, listPosts } = require("../services/posts.service");

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

module.exports = {
  create,
  list,
};
