const prisma = require("../db");

const createPost = async (data) => {
  return await prisma.post.create({
    data,
  });
};

const listPosts = async ({ skip, take, orderBy = { createdAt: "desc" }, where } = {}) => {
  const [data, total] = await prisma.$transaction([
    prisma.post.findMany({
      skip,
      take,
      orderBy,
      where,
    }),
    prisma.post.count({ where }),
  ]);
  return { data, total };
};

const getPostById = async (id) => {
  return await prisma.post.findUnique({
    where: { id },
  });
};

const updatePost = async (id, data) => {
  return await prisma.post.update({
    where: { id },
    data,
  });
};

const deletePost = async (id) => {
  return await prisma.post.delete({
    where: { id },
  });
};

module.exports = {
  createPost,
  listPosts,
  getPostById,
  updatePost,
  deletePost,
};
