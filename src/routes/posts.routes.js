const express = require("express");
const router = express.Router();
const { create } = require("../controllers/posts.controller");

router.post("/", create);

module.exports = router;
