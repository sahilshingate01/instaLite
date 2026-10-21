const prisma = require("../db");

const createPost = async (data) => {
  return await prisma.post.create({
    data,
  });
};

const listPosts = async () => {
  return await prisma.post.findMany();
};

const getPostById = async (id) => {
  return await prisma.post.findUnique({
    where: { id },
  });
};

module.exports = {
  createPost,
  listPosts,
  getPostById,
};
