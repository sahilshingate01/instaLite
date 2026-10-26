const assert = require("assert");
const { spawn } = require("child_process");
const prisma = require("./src/db");

const BASE = "http://localhost:3000";

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

const getInstaId = (p) => {
  const m = p.imageUrl.match(/insta\d+/);
  return m ? m[0] : null;
};

const getPostByPattern = async (pattern) => {
  return await prisma.post.findFirst({ where: { imageUrl: { contains: pattern } } });
};

const getUserByUsername = async (username) => {
  return await prisma.user.findUnique({ where: { username } });
};

async function run() {
  console.log("=== RUNNING FULL API TEST SUITE (PROBLEM STATEMENT 3: RELATIONS) ===\n");

  // Ensure server is running
  require("./src/index");
  await new Promise((r) => setTimeout(r, 500));

  // 1. Health check
  console.log("Testing GET /health...");
  const resHealth = await fetch(`${BASE}/health`);
  assert.strictEqual(resHealth.status, 200);
  const healthJson = await resHealth.json();
  assert.deepStrictEqual(healthJson, { status: "OK" });
  console.log("✓ GET /health passed");

  // Initial Seed
  console.log("\n--- Seeding database ---");
  await runCommand("node", ["prisma/seed.js"]);

  // --- Step 04: POST /posts needs an author ---
  console.log("\n--- Testing Step 04: POST /posts needs an author ---");
  let riya = await getUserByUsername("riya_travels");
  let arjun = await getUserByUsername("arjun_clicks");
  let p01 = await getPostByPattern("insta01");

  // 4.1 Valid create
  const s4_1 = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl: "https://picsum.photos/seed/new01/600/600",
      caption: "First post!",
      authorId: riya.id,
    }),
  });
  assert.strictEqual(s4_1.status, 201);
  const postCreated = await s4_1.json();
  assert.strictEqual(postCreated.authorId, riya.id);

  // 4.2 Missing authorId
  const s4_2 = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl: "https://picsum.photos/seed/new02/600/600" }),
  });
  assert.strictEqual(s4_2.status, 400);
  assert.deepStrictEqual(await s4_2.json(), { error: "imageUrl and authorId are required" });

  // 4.3 Missing imageUrl
  const s4_2b = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorId: riya.id }),
  });
  assert.strictEqual(s4_2b.status, 400);
  assert.deepStrictEqual(await s4_2b.json(), { error: "imageUrl and authorId are required" });

  // 4.4 Non-existent user
  const s4_3 = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl: "https://picsum.photos/seed/new03/600/600",
      authorId: 999999,
    }),
  });
  assert.strictEqual(s4_3.status, 404);
  assert.deepStrictEqual(await s4_3.json(), { error: "User not found" });

  // 4.5 PATCH authorId ignored
  const s4_4 = await fetch(`${BASE}/posts/${p01.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caption: "Baga, again 🌅",
      authorId: arjun.id,
    }),
  });
  assert.strictEqual(s4_4.status, 200);
  const patchedP01 = await s4_4.json();
  assert.strictEqual(patchedP01.caption, "Baga, again 🌅");
  assert.strictEqual(patchedP01.authorId, riya.id);
  console.log("✓ Step 04 tests passed");

  // Re-seed for Step 05-10
  await runCommand("node", ["prisma/seed.js"]);
  riya = await getUserByUsername("riya_travels");
  arjun = await getUserByUsername("arjun_clicks");
  const dev = await getUserByUsername("dev_shoots");
  const aditya = await getUserByUsername("aditya_codes");
  p01 = await getPostByPattern("insta01");
  const p05 = await getPostByPattern("insta05");
  const p24 = await getPostByPattern("insta24");

  // --- Step 05: GET /posts/:id with author and like count ---
  console.log("\n--- Testing Step 05: GET /posts/:id ---");
  const s5_1 = await (await fetch(`${BASE}/posts/${p01.id}`)).json();
  assert.strictEqual(s5_1.author.username, "riya_travels");
  assert.deepStrictEqual(s5_1._count, { likes: 5 });
  assert.strictEqual(s5_1.author.email, undefined);

  const s5_2 = await (await fetch(`${BASE}/posts/${p24.id}`)).json();
  assert.strictEqual(s5_2.author.username, "dev_shoots");
  assert.deepStrictEqual(s5_2._count, { likes: 6 });

  const s5_3 = await (await fetch(`${BASE}/posts/${p05.id}`)).json();
  assert.strictEqual(s5_3.author.username, "arjun_clicks");
  assert.deepStrictEqual(s5_3._count, { likes: 0 });

  const s5_4 = await fetch(`${BASE}/posts/999999`);
  assert.strictEqual(s5_4.status, 404);
  assert.deepStrictEqual(await s5_4.json(), { error: "Post not found" });
  console.log("✓ Step 05 tests passed");

  // --- Step 06: GET /posts with authors, like counts and sortBy=likes ---
  console.log("\n--- Testing Step 06: GET /posts ---");
  const s6_1 = await (await fetch(`${BASE}/posts?limit=2`)).json();
  assert.strictEqual(getInstaId(s6_1.data[0]), "insta24");
  assert.strictEqual(s6_1.data[0].author.username, "dev_shoots");
  assert.deepStrictEqual(s6_1.data[0]._count, { likes: 6 });
  assert.strictEqual(getInstaId(s6_1.data[1]), "insta23");
  assert.strictEqual(s6_1.data[1].author.username, "riya_travels");
  assert.deepStrictEqual(s6_1.data[1]._count, { likes: 0 });

  const s6_2 = await (await fetch(`${BASE}/posts?sortBy=likes&limit=5`)).json();
  assert.deepStrictEqual(s6_2.data.map(getInstaId), ["insta24", "insta01", "insta15", "insta10", "insta08"]);

  const s6_3 = await (await fetch(`${BASE}/posts?sortBy=likes&order=asc&limit=3`)).json();
  assert.deepStrictEqual(s6_3.data.map(getInstaId), ["insta23", "insta21", "insta19"]);

  const s6_4 = await (await fetch(`${BASE}/posts?location=goa&sortBy=likes`)).json();
  assert.deepStrictEqual(s6_4.data.map(getInstaId), ["insta01", "insta10", "insta23", "insta16"]);
  assert.strictEqual(s6_4.meta.total, 4);

  const s6_5 = await fetch(`${BASE}/posts?sortBy=comments`);
  assert.strictEqual(s6_5.status, 400);
  assert.deepStrictEqual(await s6_5.json(), { error: "sortBy must be one of: createdAt, updatedAt, likes" });
  console.log("✓ Step 06 tests passed");

  // --- Step 07: GET /users/:id with counts and hasPosts filter ---
  console.log("\n--- Testing Step 07: GET /users/:id & hasPosts ---");
  const s7_1 = await (await fetch(`${BASE}/users/${riya.id}`)).json();
  assert.strictEqual(s7_1.username, "riya_travels");
  assert.deepStrictEqual(s7_1._count, { posts: 7, likes: 4 });

  const s7_2 = await (await fetch(`${BASE}/users/${dev.id}`)).json();
  assert.strictEqual(s7_2.username, "dev_shoots");
  assert.deepStrictEqual(s7_2._count, { posts: 2, likes: 1 });

  const s7_3 = await (await fetch(`${BASE}/users/${aditya.id}`)).json();
  assert.strictEqual(s7_3.username, "aditya_codes");
  assert.deepStrictEqual(s7_3._count, { posts: 0, likes: 2 });

  const s7_4 = await (await fetch(`${BASE}/users?hasPosts=false`)).json();
  assert.strictEqual(s7_4.meta.total, 2);
  assert(s7_4.data.some((u) => u.username === "aditya_codes"));
  assert(s7_4.data.some((u) => u.username === "neha_designs"));

  const s7_5 = await (await fetch(`${BASE}/users?hasPosts=true`)).json();
  assert.strictEqual(s7_5.meta.total, 10);

  const s7_6 = await (await fetch(`${BASE}/users?hasPosts=true&isPrivate=true`)).json();
  assert.strictEqual(s7_6.meta.total, 3);
  assert.deepStrictEqual(s7_6.data.map((u) => u.username), ["dev_shoots", "ananya_reads", "meera.eats"]);

  const s7_7 = await fetch(`${BASE}/users?hasPosts=yes`);
  assert.strictEqual(s7_7.status, 400);
  assert.deepStrictEqual(await s7_7.json(), { error: "hasPosts must be true or false" });
  console.log("✓ Step 07 tests passed");

  // --- Step 08: GET /users/:id/posts ---
  console.log("\n--- Testing Step 08: GET /users/:id/posts ---");
  const s8_1 = await (await fetch(`${BASE}/users/${riya.id}/posts?limit=3`)).json();
  assert.deepStrictEqual(s8_1.data.map(getInstaId), ["insta23", "insta19", "insta16"]);
  assert.deepStrictEqual(s8_1.meta, { page: 1, limit: 3, total: 7, totalPages: 3 });
  assert.strictEqual(s8_1.data[0].author, undefined);
  assert(s8_1.data[0]._count && s8_1.data[0]._count.likes !== undefined);

  const s8_2 = await (await fetch(`${BASE}/users/${riya.id}/posts?limit=3&page=3`)).json();
  assert.deepStrictEqual(s8_2.data.map(getInstaId), ["insta01"]);
  assert.deepStrictEqual(s8_2.meta, { page: 3, limit: 3, total: 7, totalPages: 3 });

  const s8_3 = await (await fetch(`${BASE}/users/${aditya.id}/posts`)).json();
  assert.deepStrictEqual(s8_3.data, []);
  assert.deepStrictEqual(s8_3.meta, { page: 1, limit: 10, total: 0, totalPages: 0 });

  const s8_4 = await fetch(`${BASE}/users/999999/posts`);
  assert.strictEqual(s8_4.status, 404);
  assert.deepStrictEqual(await s8_4.json(), { error: "User not found" });

  const s8_5 = await fetch(`${BASE}/users/${riya.id}/posts?page=0`);
  assert.strictEqual(s8_5.status, 400);
  assert.deepStrictEqual(await s8_5.json(), { error: "page and limit must be positive integers" });
  console.log("✓ Step 08 tests passed");

  // --- Step 09: GET /posts/:id/likes ---
  console.log("\n--- Testing Step 09: GET /posts/:id/likes ---");
  const s9_1 = await (await fetch(`${BASE}/posts/${p01.id}/likes`)).json();
  assert.deepStrictEqual(s9_1.map((u) => u.username), ["arjun_clicks", "isha_dances", "meera.eats", "neha_designs", "vikram.trek"]);
  assert.strictEqual(s9_1[0].email, undefined);

  const s9_2 = await (await fetch(`${BASE}/posts/${p24.id}/likes`)).json();
  assert.deepStrictEqual(s9_2.map((u) => u.username), ["aditya_codes", "arjun_clicks", "riya_travels", "rohan_runs", "sara_sketches", "vikram.trek"]);

  const s9_3 = await (await fetch(`${BASE}/posts/${p05.id}/likes`)).json();
  assert.deepStrictEqual(s9_3, []);

  const s9_4 = await fetch(`${BASE}/posts/999999/likes`);
  assert.strictEqual(s9_4.status, 404);
  assert.deepStrictEqual(await s9_4.json(), { error: "Post not found" });
  console.log("✓ Step 09 tests passed");

  // --- Step 10: Like and Unlike ---
  console.log("\n--- Testing Step 10: Like and Unlike ---");
  const s10_1 = await fetch(`${BASE}/posts/${p05.id}/likes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: riya.id }),
  });
  assert.strictEqual(s10_1.status, 201);
  const likeCreated = await s10_1.json();
  assert.strictEqual(likeCreated.userId, riya.id);
  assert.strictEqual(likeCreated.postId, p05.id);

  const s10_2 = await fetch(`${BASE}/posts/${p05.id}/likes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: riya.id }),
  });
  assert.strictEqual(s10_2.status, 409);
  assert.deepStrictEqual(await s10_2.json(), { error: "Already liked" });

  const s10_3 = await fetch(`${BASE}/posts/${p05.id}/likes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.strictEqual(s10_3.status, 400);
  assert.deepStrictEqual(await s10_3.json(), { error: "userId is required" });

  const s10_4 = await fetch(`${BASE}/posts/999999/likes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: riya.id }),
  });
  assert.strictEqual(s10_4.status, 404);
  assert.deepStrictEqual(await s10_4.json(), { error: "Post not found" });

  const s10_5 = await fetch(`${BASE}/posts/${p05.id}/likes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: 999999 }),
  });
  assert.strictEqual(s10_5.status, 404);
  assert.deepStrictEqual(await s10_5.json(), { error: "User not found" });

  const s10_6 = await (await fetch(`${BASE}/posts/${p05.id}`)).json();
  assert.deepStrictEqual(s10_6._count, { likes: 1 });

  const s10_7 = await (await fetch(`${BASE}/posts/${p05.id}/likes`)).json();
  assert.deepStrictEqual(s10_7.map((u) => u.username), ["riya_travels"]);

  const s10_8 = await fetch(`${BASE}/posts/${p05.id}/likes/${riya.id}`, { method: "DELETE" });
  assert.strictEqual(s10_8.status, 204);

  const s10_9 = await fetch(`${BASE}/posts/${p05.id}/likes/${riya.id}`, { method: "DELETE" });
  assert.strictEqual(s10_9.status, 404);
  assert.deepStrictEqual(await s10_9.json(), { error: "Like not found" });
  console.log("✓ Step 10 tests passed");

  // --- Step 11: Cascading Deletes ---
  console.log("\n--- Testing Step 11: Cascading Deletes ---");
  await runCommand("node", ["prisma/seed.js"]);

  const riyaBeforeDel = await getUserByUsername("riya_travels");
  const arjunBeforeDel = await getUserByUsername("arjun_clicks");
  const p10BeforeDel = await getPostByPattern("insta10");
  const p24BeforeDel = await getPostByPattern("insta24");

  const delRiya = await fetch(`${BASE}/users/${riyaBeforeDel.id}`, { method: "DELETE" });
  assert.strictEqual(delRiya.status, 204);

  const s11_1 = await (await fetch(`${BASE}/users?limit=1`)).json();
  assert.strictEqual(s11_1.meta.total, 11);

  const s11_2 = await (await fetch(`${BASE}/posts?limit=1`)).json();
  assert.strictEqual(s11_2.meta.total, 17);

  const s11_3 = await (await fetch(`${BASE}/posts?location=goa`)).json();
  assert.deepStrictEqual(s11_3.data.map(getInstaId), ["insta10"]);

  const s11_4 = await (await fetch(`${BASE}/posts?sortBy=likes&limit=3`)).json();
  assert.deepStrictEqual(s11_4.data.map(getInstaId), ["insta24", "insta15", "insta17"]);
  assert.deepStrictEqual(s11_4.data.map((p) => p._count.likes), [5, 3, 2]);

  const s11_5 = await (await fetch(`${BASE}/posts/${p10BeforeDel.id}/likes`)).json();
  assert.deepStrictEqual(s11_5.map((u) => u.username), ["ananya_reads", "kabir_sings"]);

  const s11_6 = await (await fetch(`${BASE}/posts/${p24BeforeDel.id}/likes`)).json();
  assert.deepStrictEqual(s11_6.map((u) => u.username), ["aditya_codes", "arjun_clicks", "rohan_runs", "sara_sketches", "vikram.trek"]);

  const s11_7 = await (await fetch(`${BASE}/users/${arjunBeforeDel.id}`)).json();
  assert.deepStrictEqual(s11_7._count, { posts: 4, likes: 2 });

  const s11_8 = await fetch(`${BASE}/users/${riyaBeforeDel.id}/posts`);
  assert.strictEqual(s11_8.status, 404);
  assert.deepStrictEqual(await s11_8.json(), { error: "User not found" });
  console.log("✓ Step 11 tests passed");

  // Re-seed after Step 11
  await runCommand("node", ["prisma/seed.js"]);

  // --- Step 12: GET /users/:id/liked-posts ---
  console.log("\n--- Testing Step 12: GET /users/:id/liked-posts ---");
  const riyaAfterSeed = await getUserByUsername("riya_travels");
  const arjunAfterSeed = await getUserByUsername("arjun_clicks");
  const nehaAfterSeed = await getUserByUsername("neha_designs");

  const s12_1 = await (await fetch(`${BASE}/users/${riyaAfterSeed.id}/liked-posts`)).json();
  assert.deepStrictEqual(s12_1.data.map(getInstaId), ["insta24", "insta20", "insta10", "insta03"]);
  assert.deepStrictEqual(s12_1.meta, { page: 1, limit: 10, total: 4, totalPages: 1 });
  assert.strictEqual(s12_1.data[0].author.email, undefined);
  assert(s12_1.data[0]._count && s12_1.data[0]._count.likes !== undefined);

  const s12_2 = await (await fetch(`${BASE}/users/${arjunAfterSeed.id}/liked-posts?limit=2`)).json();
  assert.deepStrictEqual(s12_2.data.map(getInstaId), ["insta24", "insta14"]);
  assert.deepStrictEqual(s12_2.meta, { page: 1, limit: 2, total: 4, totalPages: 2 });

  const s12_3 = await (await fetch(`${BASE}/users/${nehaAfterSeed.id}/liked-posts`)).json();
  assert.deepStrictEqual(s12_3.data.map(getInstaId), ["insta22", "insta15", "insta01"]);
  assert.deepStrictEqual(s12_3.meta, { page: 1, limit: 10, total: 3, totalPages: 1 });

  const resNewUser = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "brand_new_user",
      email: "brand_new@example.com",
      fullname: "Brand New User",
    }),
  });
  const newUser = await resNewUser.json();
  const s12_4 = await (await fetch(`${BASE}/users/${newUser.id}/liked-posts`)).json();
  assert.deepStrictEqual(s12_4.data, []);
  assert.deepStrictEqual(s12_4.meta, { page: 1, limit: 10, total: 0, totalPages: 0 });

  const s12_5 = await fetch(`${BASE}/users/999999/liked-posts`);
  assert.strictEqual(s12_5.status, 404);
  assert.deepStrictEqual(await s12_5.json(), { error: "User not found" });
  console.log("✓ Step 12 tests passed");

  // Re-seed final
  await runCommand("node", ["prisma/seed.js"]);

  console.log("\n🎉 ALL TESTS (STEP 04 TO STEP 12 + RELATIONS + CRUD) PASSED SUCCESSFULLY! 🎉\n");
  await prisma.$disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  await prisma.$disconnect();
  process.exit(1);
});
