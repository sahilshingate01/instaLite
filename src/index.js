const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv/config");

const app = express();

app.use(express.json());

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.post("/users", async (req, res) => {
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
});

app.get("/users", async (req, res) => {
  const result = await prisma.user.findMany();
  res.json(result);
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
