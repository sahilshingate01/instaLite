const express = require("express");
const router = express.Router();
const { create, list, getOne, update } = require("../controllers/posts.controller");

router.post("/", create);
router.get("/", list);
router.get("/:id", getOne);
router.patch("/:id", update);

module.exports = router;
