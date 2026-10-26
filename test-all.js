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

async function run() {
  console.log("=== RUNNING FULL API TEST SUITE (PROBLEM STATEMENT 2) ===\n");

  // Start the server if not already running
  require("./src/index");
  // Give server brief moment to listen
  await new Promise((r) => setTimeout(r, 500));

  // 1. Health check
  console.log("Testing GET /health...");
  const resHealth = await fetch(`${BASE}/health`);
  assert.strictEqual(resHealth.status, 200);
  const healthJson = await resHealth.json();
  assert.deepStrictEqual(healthJson, { status: "OK" });
  console.log("✓ GET /health passed");

  // Re-seed DB
  console.log("\n--- Seeding database ---");
  await runCommand("node", ["prisma/seed.js"]);

  // --- CRUD Verification from previous lab ---
  console.log("\n--- Verifying CRUD from Previous Lab ---");

  // Create User
  const resCreateUser = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "test_new_user",
      email: "test_new@example.com",
      fullname: "Test New User",
      bio: "Hello world",
    }),
  });
  assert.strictEqual(resCreateUser.status, 201);
  const createdUser = await resCreateUser.json();
  assert.strictEqual(createdUser.username, "test_new_user");

  // Get User by ID
  const resGetUser = await fetch(`${BASE}/users/${createdUser.id}`);
  assert.strictEqual(resGetUser.status, 200);
  const gotUser = await resGetUser.json();
  assert.strictEqual(gotUser.id, createdUser.id);

  // Patch User
  const resPatchUser = await fetch(`${BASE}/users/${createdUser.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullname: "Updated Name",
      bio: "Updated Bio",
      isPrivate: true,
      username: "cannot_change",
    }),
  });
  assert.strictEqual(resPatchUser.status, 200);
  const patchedUser = await resPatchUser.json();
  assert.strictEqual(patchedUser.fullname, "Updated Name");
  assert.strictEqual(patchedUser.username, "test_new_user");

  // Delete User
  const resDelUser = await fetch(`${BASE}/users/${createdUser.id}`, { method: "DELETE" });
  assert.strictEqual(resDelUser.status, 204);

  // Delete User 404
  const resDelUser404 = await fetch(`${BASE}/users/${createdUser.id}`, { method: "DELETE" });
  assert.strictEqual(resDelUser404.status, 404);

  // Create Post
  const resCreatePost = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl: "https://picsum.photos/test/post",
      caption: "Test caption",
      location: "Test location",
    }),
  });
  assert.strictEqual(resCreatePost.status, 201);
  const createdPost = await resCreatePost.json();
  assert.strictEqual(createdPost.caption, "Test caption");

  // Get Post by ID
  const resGetPost = await fetch(`${BASE}/posts/${createdPost.id}`);
  assert.strictEqual(resGetPost.status, 200);
  const gotPost = await resGetPost.json();
  assert.strictEqual(gotPost.id, createdPost.id);

  // Patch Post
  const resPatchPost = await fetch(`${BASE}/posts/${createdPost.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caption: "Updated caption",
      location: "Updated location",
      imageUrl: "https://cannot-change-post",
    }),
  });
  assert.strictEqual(resPatchPost.status, 200);
  const patchedPost = await resPatchPost.json();
  assert.strictEqual(patchedPost.caption, "Updated caption");
  assert.strictEqual(patchedPost.imageUrl, "https://picsum.photos/test/post");

  // Delete Post
  const resDelPost = await fetch(`${BASE}/posts/${createdPost.id}`, { method: "DELETE" });
  assert.strictEqual(resDelPost.status, 204);

  // Delete Post 404
  const resDelPost404 = await fetch(`${BASE}/posts/${createdPost.id}`, { method: "DELETE" });
  assert.strictEqual(resDelPost404.status, 404);

  console.log("✓ Previous CRUD routes verified successfully");

  // Re-seed DB before step 04-08 verification
  console.log("\n--- Re-seeding database for Step 04-08 tests ---");
  await runCommand("node", ["prisma/seed.js"]);

  // STEP 04: Pagination on GET /users
  console.log("\n--- Testing Step 04: Pagination on GET /users ---");
  const s4_1 = await (await fetch(`${BASE}/users`)).json();
  assert.strictEqual(s4_1.data.length, 10);
  assert.strictEqual(s4_1.data[0].username, "dev_shoots");
  assert.strictEqual(s4_1.data[9].username, "meera.eats");
  assert.deepStrictEqual(s4_1.meta, { page: 1, limit: 10, total: 12, totalPages: 2 });

  const s4_2 = await (await fetch(`${BASE}/users?page=2`)).json();
  assert.deepStrictEqual(s4_2.data.map((u) => u.username), ["arjun_clicks", "riya_travels"]);
  assert.deepStrictEqual(s4_2.meta, { page: 2, limit: 10, total: 12, totalPages: 2 });

  const s4_3 = await (await fetch(`${BASE}/users?page=3&limit=5`)).json();
  assert.deepStrictEqual(s4_3.data.map((u) => u.username), ["arjun_clicks", "riya_travels"]);
  assert.deepStrictEqual(s4_3.meta, { page: 3, limit: 5, total: 12, totalPages: 3 });

  const s4_4 = await (await fetch(`${BASE}/users?limit=100`)).json();
  assert.strictEqual(s4_4.data.length, 12);
  assert.deepStrictEqual(s4_4.meta, { page: 1, limit: 50, total: 12, totalPages: 1 });

  const s4_5 = await (await fetch(`${BASE}/users?page=5`)).json();
  assert.deepStrictEqual(s4_5.data, []);
  assert.deepStrictEqual(s4_5.meta, { page: 5, limit: 10, total: 12, totalPages: 2 });

  const resS4_6 = await fetch(`${BASE}/users?page=0`);
  assert.strictEqual(resS4_6.status, 400);
  assert.deepStrictEqual(await resS4_6.json(), { error: "page and limit must be positive integers" });

  const resS4_7 = await fetch(`${BASE}/users?limit=abc`);
  assert.strictEqual(resS4_7.status, 400);
  assert.deepStrictEqual(await resS4_7.json(), { error: "page and limit must be positive integers" });

  const resS4_8 = await fetch(`${BASE}/users?page=1.5`);
  assert.strictEqual(resS4_8.status, 400);
  assert.deepStrictEqual(await resS4_8.json(), { error: "page and limit must be positive integers" });

  console.log("✓ Step 04 tests passed");

  // STEP 05: Sorting on GET /users
  console.log("\n--- Testing Step 05: Sorting on GET /users ---");
  const s5_1 = await (await fetch(`${BASE}/users?sortBy=username&order=asc`)).json();
  assert.strictEqual(s5_1.data[0].username, "aditya_codes");
  assert.strictEqual(s5_1.data[1].username, "ananya_reads");
  assert.strictEqual(s5_1.data[2].username, "arjun_clicks");
  assert.strictEqual(s5_1.meta.total, 12);
  assert.strictEqual(s5_1.meta.totalPages, 2);

  const s5_2 = await (await fetch(`${BASE}/users?sortBy=fullname&order=desc&limit=3`)).json();
  assert.deepStrictEqual(s5_2.data.map((u) => u.username), ["vikram.trek", "sara_sketches", "rohan_runs"]);
  assert.strictEqual(s5_2.meta.total, 12);
  assert.strictEqual(s5_2.meta.totalPages, 4);

  const s5_3 = await (await fetch(`${BASE}/users?order=asc&limit=2`)).json();
  assert.deepStrictEqual(s5_3.data.map((u) => u.username), ["riya_travels", "arjun_clicks"]);
  assert.strictEqual(s5_3.meta.total, 12);
  assert.strictEqual(s5_3.meta.totalPages, 6);

  const resS5_4 = await fetch(`${BASE}/users?sortBy=email`);
  assert.strictEqual(resS5_4.status, 400);
  assert.deepStrictEqual(await resS5_4.json(), { error: "sortBy must be one of: createdAt, username, fullname" });

  const resS5_5 = await fetch(`${BASE}/users?order=sideways`);
  assert.strictEqual(resS5_5.status, 400);
  assert.deepStrictEqual(await resS5_5.json(), { error: "order must be asc or desc" });

  console.log("✓ Step 05 tests passed");

  // STEP 06: Filtering on GET /users
  console.log("\n--- Testing Step 06: Filtering on GET /users ---");
  const s6_1 = await (await fetch(`${BASE}/users?isPrivate=true`)).json();
  assert.deepStrictEqual(s6_1.data.map((u) => u.username), ["dev_shoots", "neha_designs", "ananya_reads", "meera.eats"]);
  assert.strictEqual(s6_1.meta.total, 4);
  assert.strictEqual(s6_1.meta.totalPages, 1);

  const s6_2 = await (await fetch(`${BASE}/users?isPrivate=false`)).json();
  assert.strictEqual(s6_2.data.length, 8);
  assert.strictEqual(s6_2.data[0].username, "isha_dances");
  assert.strictEqual(s6_2.data[1].username, "aditya_codes");
  assert.strictEqual(s6_2.meta.total, 8);
  assert.strictEqual(s6_2.meta.totalPages, 1);

  const s6_3 = await (await fetch(`${BASE}/users?search=sh`)).json();
  assert.deepStrictEqual(s6_3.data.map((u) => u.username), ["dev_shoots", "isha_dances", "riya_travels"]);
  assert.strictEqual(s6_3.meta.total, 3);
  assert.strictEqual(s6_3.meta.totalPages, 1);

  const s6_4 = await (await fetch(`${BASE}/users?search=SH&isPrivate=false&sortBy=fullname&order=asc&limit=2`)).json();
  assert.deepStrictEqual(s6_4.data.map((u) => u.username), ["isha_dances", "riya_travels"]);
  assert.strictEqual(s6_4.meta.total, 2);
  assert.strictEqual(s6_4.meta.totalPages, 1);

  const s6_5 = await (await fetch(`${BASE}/users?search=zzz`)).json();
  assert.deepStrictEqual(s6_5.data, []);
  assert.strictEqual(s6_5.meta.total, 0);
  assert.strictEqual(s6_5.meta.totalPages, 0);

  const resS6_6 = await fetch(`${BASE}/users?isPrivate=maybe`);
  assert.strictEqual(resS6_6.status, 400);
  assert.deepStrictEqual(await resS6_6.json(), { error: "isPrivate must be true or false" });

  console.log("✓ Step 06 tests passed");

  // Helper for posts
  const getInstaId = (p) => {
    const m = p.imageUrl.match(/insta\d+/);
    return m ? m[0] : null;
  };

  // STEP 07: Pagination & sorting on GET /posts
  console.log("\n--- Testing Step 07: Pagination & sorting on GET /posts ---");
  const s7_1 = await (await fetch(`${BASE}/posts`)).json();
  assert.strictEqual(s7_1.data.length, 10);
  assert.strictEqual(getInstaId(s7_1.data[0]), "insta24");
  assert.strictEqual(getInstaId(s7_1.data[9]), "insta15");
  assert.deepStrictEqual(s7_1.meta, { page: 1, limit: 10, total: 24, totalPages: 3 });

  const s7_2 = await (await fetch(`${BASE}/posts?page=3`)).json();
  assert.deepStrictEqual(s7_2.data.map(getInstaId), ["insta04", "insta03", "insta02", "insta01"]);
  assert.deepStrictEqual(s7_2.meta, { page: 3, limit: 10, total: 24, totalPages: 3 });

  const s7_3 = await (await fetch(`${BASE}/posts?page=4`)).json();
  assert.deepStrictEqual(s7_3.data, []);
  assert.deepStrictEqual(s7_3.meta, { page: 4, limit: 10, total: 24, totalPages: 3 });

  const s7_4 = await (await fetch(`${BASE}/posts?order=asc&limit=3`)).json();
  assert.deepStrictEqual(s7_4.data.map(getInstaId), ["insta01", "insta02", "insta03"]);
  assert.deepStrictEqual(s7_4.meta, { page: 1, limit: 3, total: 24, totalPages: 8 });

  const resS7_5 = await fetch(`${BASE}/posts?limit=0`);
  assert.strictEqual(resS7_5.status, 400);
  assert.deepStrictEqual(await resS7_5.json(), { error: "page and limit must be positive integers" });

  const resS7_6 = await fetch(`${BASE}/posts?sortBy=caption`);
  assert.strictEqual(resS7_6.status, 400);
  assert.deepStrictEqual(await resS7_6.json(), { error: "sortBy must be one of: createdAt, updatedAt" });

  const resS7_7 = await fetch(`${BASE}/posts?order=up`);
  assert.strictEqual(resS7_7.status, 400);
  assert.deepStrictEqual(await resS7_7.json(), { error: "order must be asc or desc" });

  console.log("✓ Step 07 tests passed");

  // STEP 08: Filtering on GET /posts
  console.log("\n--- Testing Step 08: Filtering on GET /posts ---");
  const s8_1 = await (await fetch(`${BASE}/posts?location=GOA`)).json();
  assert.deepStrictEqual(s8_1.data.map(getInstaId), ["insta23", "insta16", "insta10", "insta01"]);
  assert.strictEqual(s8_1.meta.total, 4);
  assert.strictEqual(s8_1.meta.totalPages, 1);

  const s8_2 = await (await fetch(`${BASE}/posts?search=sunset`)).json();
  assert.deepStrictEqual(s8_2.data.map(getInstaId), ["insta20", "insta08", "insta01"]);
  assert.strictEqual(s8_2.meta.total, 3);
  assert.strictEqual(s8_2.meta.totalPages, 1);

  const s8_3 = await (await fetch(`${BASE}/posts?from=2026-03-01&to=2026-04-01`)).json();
  assert.strictEqual(s8_3.data.length, 8);
  assert.strictEqual(getInstaId(s8_3.data[0]), "insta16");
  assert.strictEqual(getInstaId(s8_3.data[7]), "insta09");
  assert.strictEqual(s8_3.meta.total, 8);
  assert.strictEqual(s8_3.meta.totalPages, 1);

  const s8_4 = await (await fetch(`${BASE}/posts?from=2026-04-01`)).json();
  assert.strictEqual(s8_4.data.length, 8);
  assert.strictEqual(getInstaId(s8_4.data[0]), "insta24");
  assert.strictEqual(getInstaId(s8_4.data[7]), "insta17");
  assert.strictEqual(s8_4.meta.total, 8);
  assert.strictEqual(s8_4.meta.totalPages, 1);

  const s8_5 = await (await fetch(`${BASE}/posts?location=pune&search=CHAI`)).json();
  assert.deepStrictEqual(s8_5.data.map(getInstaId), ["insta15"]);
  assert.strictEqual(s8_5.meta.total, 1);
  assert.strictEqual(s8_5.meta.totalPages, 1);

  const s8_6 = await (await fetch(`${BASE}/posts?location=mumbai&limit=2&page=2`)).json();
  assert.deepStrictEqual(s8_6.data.map(getInstaId), ["insta06", "insta02"]);
  assert.strictEqual(s8_6.meta.total, 4);
  assert.strictEqual(s8_6.meta.totalPages, 2);

  const resS8_7 = await fetch(`${BASE}/posts?from=yesterday`);
  assert.strictEqual(resS8_7.status, 400);
  assert.deepStrictEqual(await resS8_7.json(), { error: "from and to must be valid dates" });

  console.log("✓ Step 08 tests passed");

  console.log("\n🎉 ALL TESTS (STEP 04 TO STEP 08 + CRUD) PASSED SUCCESSFULLY! 🎉\n");
  await prisma.$disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  await prisma.$disconnect();
  process.exit(1);
});
