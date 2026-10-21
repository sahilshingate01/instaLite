const prisma = require("../db");

const createUser = async (data) => {
  const result = await prisma.user.create({
    data,
  });
  return result;
};

const listUsers = async () => {
  return await prisma.user.findMany();
};

const getUserById = async (id) => {
  return await prisma.user.findUnique({
    where: { id },
  });
};

const updateUser = async (id, data) => {
  return await prisma.user.update({
    where: { id },
    data,
  });
};

const deleteUser = async (id) => {
  return await prisma.user.delete({
    where: {
      id,
    },
  });
};

module.exports = { createUser, listUsers, getUserById, updateUser, deleteUser };
