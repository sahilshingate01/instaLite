const assert = require("assert");
const prisma = require("./src/db");

const BASE = "http://localhost:3000";

async function run() {
  console.log("=== RUNNING FULL API TEST SUITE ===\n");

  // Clean DB before test run
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "Post" RESTART IDENTITY CASCADE;');

  // 1. Health check
  console.log("Testing GET /health...");
  const resHealth = await fetch(`${BASE}/health`);
  assert.strictEqual(resHealth.status, 200);
  const healthJson = await resHealth.json();
  assert.deepStrictEqual(healthJson, { status: "OK" });
  console.log("✓ GET /health passed");

  // USERS
  console.log("\n--- Testing USERS ---");

  // 2. Create User 1
  console.log("Testing POST /users (valid)...");
  const resU1 = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "riya_travels",
      email: "riya@example.com",
      fullname: "Riya Sharma",
    }),
  });
  assert.strictEqual(resU1.status, 201);
  const u1 = await resU1.json();
  assert.strictEqual(u1.username, "riya_travels");
  assert.strictEqual(u1.email, "riya@example.com");
  assert.strictEqual(u1.fullname, "Riya Sharma");
  assert.strictEqual(u1.bio, null);
  assert.strictEqual(u1.isPrivate, false);
  assert(u1.id !== undefined);
  assert(u1.createdAt !== undefined);
  assert(u1.updatedAt !== undefined);
  console.log("✓ POST /users (valid) passed, created id:", u1.id);

  // 3. Create User Duplicate (409)
  console.log("Testing POST /users (duplicate username)...");
  const resU2 = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "riya_travels",
      email: "other@example.com",
      fullname: "Copy Cat",
    }),
  });
  assert.strictEqual(resU2.status, 409);
  const u2Json = await resU2.json();
  assert.deepStrictEqual(u2Json, { error: "username or email already taken" });
  console.log("✓ POST /users (duplicate) passed 409");

  // 4. Create User Missing Field (400)
  console.log("Testing POST /users (missing required field)...");
  const resU3 = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "onlyname" }),
  });
  assert.strictEqual(resU3.status, 400);
  const u3Json = await resU3.json();
  assert.deepStrictEqual(u3Json, { error: "username, email and fullname are required" });
  console.log("✓ POST /users (missing field) passed 400");

  // 5. Create User Ignored Fields (not 999)
  console.log("Testing POST /users (sneaky id: 999)...");
  const resU4 = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "sneaky",
      email: "sneaky@example.com",
      fullname: "Sneaky",
      id: 999,
    }),
  });
  assert.strictEqual(resU4.status, 201);
  const u4 = await resU4.json();
  assert.notStrictEqual(u4.id, 999);
  assert.strictEqual(u4.username, "sneaky");
  console.log("✓ POST /users (sneaky id ignored) passed, id is:", u4.id);

  // 6. List Users
  console.log("Testing GET /users...");
  const resListU = await fetch(`${BASE}/users`);
  assert.strictEqual(resListU.status, 200);
  const usersList = await resListU.json();
  assert(Array.isArray(usersList));
  assert(usersList.length >= 2);
  console.log("✓ GET /users passed, found users:", usersList.length);

  // 7. Get User by ID
  console.log(`Testing GET /users/${u1.id}...`);
  const resGetU = await fetch(`${BASE}/users/${u1.id}`);
  assert.strictEqual(resGetU.status, 200);
  const getU = await resGetU.json();
  assert.strictEqual(getU.id, u1.id);
  assert.strictEqual(getU.username, "riya_travels");
  console.log("✓ GET /users/:id passed");

  // 8. Get User by ID (404)
  console.log("Testing GET /users/999999 (404)...");
  const resGetU404 = await fetch(`${BASE}/users/999999`);
  assert.strictEqual(resGetU404.status, 404);
  const getU404Json = await resGetU404.json();
  assert.deepStrictEqual(getU404Json, { error: "User not found" });
  console.log("✓ GET /users/:id (404) passed");

  // 9. Patch User
  console.log(`Testing PATCH /users/${u1.id}...`);
  const resPatchU = await fetch(`${BASE}/users/${u1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullname: "Riya S. Sharma",
      bio: "Photographer & nomad",
      isPrivate: true,
      username: "cannot_change",
      email: "cannot_change@example.com",
    }),
  });
  assert.strictEqual(resPatchU.status, 200);
  const patchedU = await resPatchU.json();
  assert.strictEqual(patchedU.fullname, "Riya S. Sharma");
  assert.strictEqual(patchedU.bio, "Photographer & nomad");
  assert.strictEqual(patchedU.isPrivate, true);
  assert.strictEqual(patchedU.username, "riya_travels");
  assert.strictEqual(patchedU.email, "riya@example.com");
  console.log("✓ PATCH /users/:id passed (uneditable fields ignored)");

  // 10. Patch User (404)
  console.log("Testing PATCH /users/999999 (404)...");
  const resPatchU404 = await fetch(`${BASE}/users/999999`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bio: "Ghost" }),
  });
  assert.strictEqual(resPatchU404.status, 404);
  const patchU404Json = await resPatchU404.json();
  assert.deepStrictEqual(patchU404Json, { error: "User not found" });
  console.log("✓ PATCH /users/:id (404) passed");

  // 11. Delete User
  console.log(`Testing DELETE /users/${u1.id}...`);
  const resDelU = await fetch(`${BASE}/users/${u1.id}`, { method: "DELETE" });
  assert.strictEqual(resDelU.status, 204);
  const delUText = await resDelU.text();
  assert.strictEqual(delUText, "");
  console.log("✓ DELETE /users/:id passed (204 Empty)");

  // 12. Delete User (404)
  console.log(`Testing DELETE /users/${u1.id} again (404)...`);
  const resDelU404 = await fetch(`${BASE}/users/${u1.id}`, { method: "DELETE" });
  assert.strictEqual(resDelU404.status, 404);
  const delU404Json = await resDelU404.json();
  assert.deepStrictEqual(delU404Json, { error: "User not found" });
  console.log("✓ DELETE /users/:id (404) passed");

  // POSTS
  console.log("\n--- Testing POSTS ---");

  // 13. Create Post
  console.log("Testing POST /posts (valid)...");
  const resP1 = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl: "https://images.unsplash.com/photo-1.jpg",
      caption: "Sunny morning in Paris",
      location: "Paris, France",
    }),
  });
  assert.strictEqual(resP1.status, 201);
  const p1 = await resP1.json();
  assert.strictEqual(p1.imageUrl, "https://images.unsplash.com/photo-1.jpg");
  assert.strictEqual(p1.caption, "Sunny morning in Paris");
  assert.strictEqual(p1.location, "Paris, France");
  assert(p1.id !== undefined);
  assert(p1.createdAt !== undefined);
  assert(p1.updatedAt !== undefined);
  console.log("✓ POST /posts (valid) passed, created id:", p1.id);

  // 14. Create Post Missing imageUrl (400)
  console.log("Testing POST /posts (missing imageUrl)...");
  const resP2 = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caption: "Missing image" }),
  });
  assert.strictEqual(resP2.status, 400);
  const p2Json = await resP2.json();
  assert.deepStrictEqual(p2Json, { error: "imageUrl is required" });
  console.log("✓ POST /posts (missing imageUrl) passed 400");

  // 15. Create Post Ignored Fields
  console.log("Testing POST /posts (ignoring extra fields)...");
  const resP3 = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl: "https://images.unsplash.com/photo-2.jpg",
      id: 888,
    }),
  });
  assert.strictEqual(resP3.status, 201);
  const p3 = await resP3.json();
  assert.notStrictEqual(p3.id, 888);
  console.log("✓ POST /posts (extra field ignored) passed, id is:", p3.id);

  // 16. List Posts
  console.log("Testing GET /posts...");
  const resListP = await fetch(`${BASE}/posts`);
  assert.strictEqual(resListP.status, 200);
  const postsList = await resListP.json();
  assert(Array.isArray(postsList));
  assert(postsList.length >= 2);
  console.log("✓ GET /posts passed, found posts:", postsList.length);

  // 17. Get Post by ID
  console.log(`Testing GET /posts/${p1.id}...`);
  const resGetP = await fetch(`${BASE}/posts/${p1.id}`);
  assert.strictEqual(resGetP.status, 200);
  const getP = await resGetP.json();
  assert.strictEqual(getP.id, p1.id);
  assert.strictEqual(getP.imageUrl, "https://images.unsplash.com/photo-1.jpg");
  console.log("✓ GET /posts/:id passed");

  // 18. Get Post by ID (404)
  console.log("Testing GET /posts/999999 (404)...");
  const resGetP404 = await fetch(`${BASE}/posts/999999`);
  assert.strictEqual(resGetP404.status, 404);
  const getP404Json = await resGetP404.json();
  assert.deepStrictEqual(getP404Json, { error: "Post not found" });
  console.log("✓ GET /posts/:id (404) passed");

  // 19. Patch Post
  console.log(`Testing PATCH /posts/${p1.id}...`);
  const resPatchP = await fetch(`${BASE}/posts/${p1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caption: "Rainy evening in Paris",
      location: "Eiffel Tower",
      imageUrl: "https://cannot-change-this.jpg",
    }),
  });
  assert.strictEqual(resPatchP.status, 200);
  const patchedP = await resPatchP.json();
  assert.strictEqual(patchedP.caption, "Rainy evening in Paris");
  assert.strictEqual(patchedP.location, "Eiffel Tower");
  assert.strictEqual(patchedP.imageUrl, "https://images.unsplash.com/photo-1.jpg");
  console.log("✓ PATCH /posts/:id passed (imageUrl uneditable)");

  // 20. Patch Post (404)
  console.log("Testing PATCH /posts/999999 (404)...");
  const resPatchP404 = await fetch(`${BASE}/posts/999999`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caption: "Ghost" }),
  });
  assert.strictEqual(resPatchP404.status, 404);
  const patchP404Json = await resPatchP404.json();
  assert.deepStrictEqual(patchP404Json, { error: "Post not found" });
  console.log("✓ PATCH /posts/:id (404) passed");

  // 21. Delete Post
  console.log(`Testing DELETE /posts/${p1.id}...`);
  const resDelP = await fetch(`${BASE}/posts/${p1.id}`, { method: "DELETE" });
  assert.strictEqual(resDelP.status, 204);
  const delPText = await resDelP.text();
  assert.strictEqual(delPText, "");
  console.log("✓ DELETE /posts/:id passed (204 Empty)");

  // 22. Delete Post (404)
  console.log(`Testing DELETE /posts/${p1.id} again (404)...`);
  const resDelP404 = await fetch(`${BASE}/posts/${p1.id}`, { method: "DELETE" });
  assert.strictEqual(resDelP404.status, 404);
  const delP404Json = await resDelP404.json();
  assert.deepStrictEqual(delP404Json, { error: "Post not found" });
  console.log("✓ DELETE /posts/:id (404) passed");

  console.log("\n🎉 ALL 22 TEST CASES PASSED SUCCESSFULLY! 🎉\n");
  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  await prisma.$disconnect();
  process.exit(1);
});
