const prisma = require("../db");

const createPost = async (data) => {
  return await prisma.post.create({
    data,
  });
};

const listPosts = async () => {
  return await prisma.post.findMany();
};

module.exports = {
  createPost,
  listPosts,
};
