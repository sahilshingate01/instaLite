const express = require("express");
const router = express.Router();
const { create, list, getOne } = require("../controllers/posts.controller");

router.post("/", create);
router.get("/", list);
router.get("/:id", getOne);

module.exports = router;
