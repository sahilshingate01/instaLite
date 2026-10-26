const prisma = require("../src/db");
const { users, posts } = require("./seed-data");

async function main() {
  let errorOccurred = false;
  try {
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();

    const usersResult = await prisma.user.createMany({
      data: users,
    });

    const postsResult = await prisma.post.createMany({
      data: posts,
    });

    console.log(`🌱 Seeded ${usersResult.count} users and ${postsResult.count} posts`);
  } catch (err) {
    console.error(err);
    errorOccurred = true;
  } finally {
    await prisma.$disconnect();
    if (errorOccurred) {
      process.exit(1);
    }
  }
}

main();
