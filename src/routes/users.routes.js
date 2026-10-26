const express = require("express");
const router = express.Router();

const {
  create,
  list,
  getOne,
  getPosts,
  getLikedPosts,
  update,
  remove,
} = require("../controllers/users.controller");

router.post("/", create);
router.get("/", list);
router.get("/:id", getOne);
router.get("/:id/posts", getPosts);
router.get("/:id/liked-posts", getLikedPosts);
router.patch("/:id", update);
router.delete("/:id", remove);

module.exports = router;
