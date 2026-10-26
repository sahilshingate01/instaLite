const express = require("express");
const router = express.Router();
const {
  create,
  list,
  getOne,
  getLikes,
  update,
  remove,
} = require("../controllers/posts.controller");
const likesController = require("../controllers/likes.controller");

router.post("/", create);
router.get("/", list);
router.get("/:id", getOne);
router.get("/:id/likes", getLikes);
router.post("/:id/likes", likesController.create);
router.delete("/:id/likes/:userId", likesController.remove);
router.patch("/:id", update);
router.delete("/:id", remove);

module.exports = router;
