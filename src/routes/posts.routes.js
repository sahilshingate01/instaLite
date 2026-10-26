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

router.post("/", create);
router.get("/", list);
router.get("/:id", getOne);
router.get("/:id/likes", getLikes);
router.patch("/:id", update);
router.delete("/:id", remove);

module.exports = router;
