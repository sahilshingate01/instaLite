const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv/config");

const app = express();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
