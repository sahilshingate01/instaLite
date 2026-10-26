const { likePost, unlikePost } = require("../services/likes.service");

const create = async (req, res) => {
  const { userId } = req.body || {};
  if (userId === undefined || userId === null || userId === "") {
    return res.status(400).json({ error: "userId is required" });
  }

  const postId = Number(req.params.id);
  const userIdNum = Number(userId);

  try {
    const like = await likePost(postId, userIdNum);
    res.status(201).json(like);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Already liked" });
    }
    res.status(500).json({ error: "Something went wrong" });
  }
};

const remove = async (req, res) => {
  const postId = Number(req.params.id);
  const userId = Number(req.params.userId);

  try {
    await unlikePost(postId, userId);
    res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Like not found" });
    }
    res.status(404).json({ error: "Like not found" });
  }
};

module.exports = {
  create,
  remove,
};
