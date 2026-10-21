const express = require("express");
const router = express.Router();
const { create, list } = require("../controllers/posts.controller");

router.post("/", create);
router.get("/", list);

module.exports = router;
