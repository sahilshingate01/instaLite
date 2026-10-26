const prisma = require("../db");

const likePost = async (postId, userId) => {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    const error = new Error("Post not found");
    error.status = 404;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  return await prisma.like.create({
    data: {
      postId,
      userId,
    },
  });
};

const unlikePost = async (postId, userId) => {
  return await prisma.like.delete({
    where: {
      userId_postId: {
        userId,
        postId,
      },
    },
  });
};

module.exports = {
  likePost,
  unlikePost,
};
