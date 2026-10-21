const prisma = require("../db");

const create = async (req, res) => {
  try {
    const { username, email, fullname, bio } = req.body || {};
    if (!username || !email || !fullname) {
      return res
        .status(400)
        .json({ error: "username, email and fullname are required" });
    }

    const userData = { username, email, fullname };
    if (bio !== undefined) {
      userData.bio = bio;
    }

    const result = await prisma.user.create({
      data: userData,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(409).json({ error: "username or email already taken" });
  }
};

const list = async (req, res) => {
  const result = await prisma.user.findMany();
  res.json(result);
};

const getOne = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
};

const update = async (req, res) => {
  try {
    const data = {};
    if (req.body && req.body.fullname !== undefined) data.fullname = req.body.fullname;
    if (req.body && req.body.bio !== undefined) data.bio = req.body.bio;
    if (req.body && req.body.isPrivate !== undefined) data.isPrivate = req.body.isPrivate;

    const updatedUser = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(updatedUser);
  } catch (err) {
    res.status(404).json({ error: "User not found" });
  }
};

const remove = async (req, res) => {
  try {
    await prisma.user.delete({
      where: {
        id: Number(req.params.id),
      },
    });
    res.status(204).send();
  } catch (err) {
    res.status(404).json({ error: "User not found" });
  }
};

module.exports = { create, list, getOne, update, remove };
