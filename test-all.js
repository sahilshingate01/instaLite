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
  console.log("=================================================================");
  console.log("=== RUNNING FULL API TEST SUITE (LAB 1, LAB 2 & LAB 3) ===");
  console.log("=================================================================\n");

  // Ensure server is running
  require("./src/index");
  await new Promise((r) => setTimeout(r, 500));

  // =================================================================
  // PART 1: LAB 1 - EXPRESS SERVER, HEALTH CHECK & CRUD
  // =================================================================
  console.log(">>> [LAB 1] Testing Step 01: GET /health");
  const resHealth = await fetch(`${BASE}/health`);
  assert.strictEqual(resHealth.status, 200);
  const healthJson = await resHealth.json();
  assert.deepStrictEqual(healthJson, { status: "OK" });
  console.log("✓ GET /health passed");

  console.log("\n>>> [LAB 1] Testing Step 04: POST /users");
  // 1. Valid user creation with extra id (should be ignored)
  const resUser1 = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "test_crud_user",
      email: "crud_user@example.com",
      fullname: "Crud User",
      bio: "Hello world",
      id: 99999,
    }),
  });
  assert.strictEqual(resUser1.status, 201);
  const createdUser1 = await resUser1.json();
  assert.strictEqual(createdUser1.username, "test_crud_user");
  assert.strictEqual(createdUser1.email, "crud_user@example.com");
  assert.notStrictEqual(createdUser1.id, 99999);
  assert.strictEqual(createdUser1.bio, "Hello world");
  assert.strictEqual(createdUser1.isPrivate, false);

  // 2. Duplicate username / email (409)
  const resUserDup = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "test_crud_user",
      email: "different@example.com",
      fullname: "Copy Cat",
    }),
  });
  assert.strictEqual(resUserDup.status, 409);
  assert.deepStrictEqual(await resUserDup.json(), { error: "username or email already taken" });

  // 3. Missing required field (400)
  const resUserMissing = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "onlyname" }),
  });
  assert.strictEqual(resUserMissing.status, 400);
  assert.deepStrictEqual(await resUserMissing.json(), {
    error: "username, email and fullname are required",
  });

  console.log("\n>>> [LAB 1] Testing Step 06 & 07 & 08: GET/PATCH/DELETE /users/:id");
  // GET /users/:id exists
  const resGetUser = await fetch(`${BASE}/users/${createdUser1.id}`);
  assert.strictEqual(resGetUser.status, 200);
  const getUserJson = await resGetUser.json();
  assert.strictEqual(getUserJson.username, "test_crud_user");

  // GET /users/:id not found
  const resGetUser404 = await fetch(`${BASE}/users/999999`);
  assert.strictEqual(resGetUser404.status, 404);
  assert.deepStrictEqual(await resGetUser404.json(), { error: "User not found" });

  // PATCH /users/:id: update fullname, bio, isPrivate; username and email ignored
  const resPatchUser = await fetch(`${BASE}/users/${createdUser1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "should_be_ignored",
      email: "ignored@example.com",
      fullname: "Updated Name",
      bio: "Updated bio",
      isPrivate: true,
    }),
  });
  assert.strictEqual(resPatchUser.status, 200);
  const patchedUser = await resPatchUser.json();
  assert.strictEqual(patchedUser.fullname, "Updated Name");
  assert.strictEqual(patchedUser.bio, "Updated bio");
  assert.strictEqual(patchedUser.isPrivate, true);
  assert.strictEqual(patchedUser.username, "test_crud_user");
  assert.strictEqual(patchedUser.email, "crud_user@example.com");

  // PATCH non-existent user (404)
  const resPatchUser404 = await fetch(`${BASE}/users/999999`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullname: "Ghost" }),
  });
  assert.strictEqual(resPatchUser404.status, 404);
  assert.deepStrictEqual(await resPatchUser404.json(), { error: "User not found" });

  // DELETE /users/:id
  const resDelUser = await fetch(`${BASE}/users/${createdUser1.id}`, { method: "DELETE" });
  assert.strictEqual(resDelUser.status, 204);

  // DELETE again -> 404
  const resDelUser404 = await fetch(`${BASE}/users/${createdUser1.id}`, { method: "DELETE" });
  assert.strictEqual(resDelUser404.status, 404);
  assert.deepStrictEqual(await resDelUser404.json(), { error: "User not found" });
  console.log("✓ Lab 1 User CRUD tests passed");

  // =================================================================
  // PART 2: LAB 2 - SEEDING, PAGINATION, SORTING & FILTERING
  // =================================================================
  console.log("\n=================================================================");
  console.log(">>> [LAB 2] Seeding database via npm run seed...");
  await runCommand("npm", ["run", "seed"]);

  console.log("\n>>> [LAB 2] Testing Step 04: Pagination on GET /users");
  // 1. Default pagination (page 1, limit 10)
  const uPage1 = await (await fetch(`${BASE}/users`)).json();
  assert.strictEqual(uPage1.data.length, 10);
  assert.strictEqual(uPage1.data[0].username, "dev_shoots");
  assert.strictEqual(uPage1.data[9].username, "meera.eats");
  assert.deepStrictEqual(uPage1.meta, { page: 1, limit: 10, total: 12, totalPages: 2 });

  // 2. Page 2
  const uPage2 = await (await fetch(`${BASE}/users?page=2`)).json();
  assert.deepStrictEqual(uPage2.data.map((u) => u.username), ["arjun_clicks", "riya_travels"]);
  assert.deepStrictEqual(uPage2.meta, { page: 2, limit: 10, total: 12, totalPages: 2 });

  // 3. Page 3, limit 5
  const uPage3Limit5 = await (await fetch(`${BASE}/users?page=3&limit=5`)).json();
  assert.deepStrictEqual(uPage3Limit5.data.map((u) => u.username), ["arjun_clicks", "riya_travels"]);
  assert.deepStrictEqual(uPage3Limit5.meta, { page: 3, limit: 5, total: 12, totalPages: 3 });

  // 4. Limit capped at 50
  const uLimit100 = await (await fetch(`${BASE}/users?limit=100`)).json();
  assert.strictEqual(uLimit100.data.length, 12);
  assert.deepStrictEqual(uLimit100.meta, { page: 1, limit: 50, total: 12, totalPages: 1 });

  // 5. Page beyond last page
  const uPage5 = await (await fetch(`${BASE}/users?page=5`)).json();
  assert.deepStrictEqual(uPage5.data, []);
  assert.deepStrictEqual(uPage5.meta, { page: 5, limit: 10, total: 12, totalPages: 2 });

  // 6, 7, 8: Invalid page / limit (400)
  for (const q of ["page=0", "limit=abc", "page=1.5"]) {
    const res = await fetch(`${BASE}/users?${q}`);
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(await res.json(), {
      error: "page and limit must be positive integers",
    });
  }
  console.log("✓ Lab 2 Step 04 pagination passed");

  console.log("\n>>> [LAB 2] Testing Step 05: Sorting on GET /users");
  // 1. sortBy=username&order=asc
  const uSortUserAsc = await (await fetch(`${BASE}/users?sortBy=username&order=asc`)).json();
  assert.strictEqual(uSortUserAsc.data[0].username, "aditya_codes");
  assert.strictEqual(uSortUserAsc.data[1].username, "ananya_reads");
  assert.strictEqual(uSortUserAsc.data[2].username, "arjun_clicks");

  // 2. sortBy=fullname&order=desc&limit=3
  const uSortFullDesc = await (
    await fetch(`${BASE}/users?sortBy=fullname&order=desc&limit=3`)
  ).json();
  assert.deepStrictEqual(uSortFullDesc.data.map((u) => u.username), [
    "vikram.trek",
    "sara_sketches",
    "rohan_runs",
  ]);
  assert.deepStrictEqual(uSortFullDesc.meta, { page: 1, limit: 3, total: 12, totalPages: 4 });

  // 3. order=asc&limit=2 (oldest first)
  const uOrderAsc = await (await fetch(`${BASE}/users?order=asc&limit=2`)).json();
  assert.deepStrictEqual(uOrderAsc.data.map((u) => u.username), ["riya_travels", "arjun_clicks"]);
  assert.deepStrictEqual(uOrderAsc.meta, { page: 1, limit: 2, total: 12, totalPages: 6 });

  // 4. sortBy not allowed
  const uSortInvalid = await fetch(`${BASE}/users?sortBy=email`);
  assert.strictEqual(uSortInvalid.status, 400);
  assert.deepStrictEqual(await uSortInvalid.json(), {
    error: "sortBy must be one of: createdAt, username, fullname",
  });

  // 5. order not allowed
  const uOrderInvalid = await fetch(`${BASE}/users?order=sideways`);
  assert.strictEqual(uOrderInvalid.status, 400);
  assert.deepStrictEqual(await uOrderInvalid.json(), { error: "order must be asc or desc" });
  console.log("✓ Lab 2 Step 05 sorting passed");

  console.log("\n>>> [LAB 2] Testing Step 06: Filtering on GET /users");
  // 1. isPrivate=true
  const uPrivate = await (await fetch(`${BASE}/users?isPrivate=true`)).json();
  assert.deepStrictEqual(uPrivate.data.map((u) => u.username), [
    "dev_shoots",
    "neha_designs",
    "ananya_reads",
    "meera.eats",
  ]);
  assert.strictEqual(uPrivate.meta.total, 4);

  // 2. isPrivate=false
  const uPublic = await (await fetch(`${BASE}/users?isPrivate=false`)).json();
  assert.strictEqual(uPublic.data.length, 8);
  assert.strictEqual(uPublic.data[0].username, "isha_dances");
  assert.strictEqual(uPublic.data[1].username, "aditya_codes");
  assert.strictEqual(uPublic.meta.total, 8);

  // 3. search=sh
  const uSearchSh = await (await fetch(`${BASE}/users?search=sh`)).json();
  assert.deepStrictEqual(uSearchSh.data.map((u) => u.username), [
    "dev_shoots",
    "isha_dances",
    "riya_travels",
  ]);
  assert.strictEqual(uSearchSh.meta.total, 3);

  // 4. search=SH&isPrivate=false&sortBy=fullname&order=asc&limit=2
  const uSearchComplex = await (
    await fetch(`${BASE}/users?search=SH&isPrivate=false&sortBy=fullname&order=asc&limit=2`)
  ).json();
  assert.deepStrictEqual(uSearchComplex.data.map((u) => u.username), [
    "isha_dances",
    "riya_travels",
  ]);
  assert.strictEqual(uSearchComplex.meta.total, 2);

  // 5. search=zzz
  const uSearchZzz = await (await fetch(`${BASE}/users?search=zzz`)).json();
  assert.deepStrictEqual(uSearchZzz.data, []);
  assert.deepStrictEqual(uSearchZzz.meta, { page: 1, limit: 10, total: 0, totalPages: 0 });

  // 6. isPrivate=maybe (400)
  const uPrivateInvalid = await fetch(`${BASE}/users?isPrivate=maybe`);
  assert.strictEqual(uPrivateInvalid.status, 400);
  assert.deepStrictEqual(await uPrivateInvalid.json(), { error: "isPrivate must be true or false" });
  console.log("✓ Lab 2 Step 06 filtering passed");

  console.log("\n>>> [LAB 2] Testing Step 07: Pagination & Sorting on GET /posts");
  const pPage1 = await (await fetch(`${BASE}/posts`)).json();
  assert.strictEqual(pPage1.data.length, 10);
  assert.strictEqual(getInstaId(pPage1.data[0]), "insta24");
  assert.strictEqual(getInstaId(pPage1.data[9]), "insta15");
  assert.deepStrictEqual(pPage1.meta, { page: 1, limit: 10, total: 24, totalPages: 3 });

  const pPage3 = await (await fetch(`${BASE}/posts?page=3`)).json();
  assert.deepStrictEqual(pPage3.data.map(getInstaId), ["insta04", "insta03", "insta02", "insta01"]);
  assert.deepStrictEqual(pPage3.meta, { page: 3, limit: 10, total: 24, totalPages: 3 });

  const pPage4 = await (await fetch(`${BASE}/posts?page=4`)).json();
  assert.deepStrictEqual(pPage4.data, []);
  assert.deepStrictEqual(pPage4.meta, { page: 4, limit: 10, total: 24, totalPages: 3 });

  const pOrderAsc = await (await fetch(`${BASE}/posts?order=asc&limit=3`)).json();
  assert.deepStrictEqual(pOrderAsc.data.map(getInstaId), ["insta01", "insta02", "insta03"]);
  assert.deepStrictEqual(pOrderAsc.meta, { page: 1, limit: 3, total: 24, totalPages: 8 });

  for (const [q, expectedErr] of [
    ["limit=0", "page and limit must be positive integers"],
    ["sortBy=caption", "sortBy must be one of: createdAt, updatedAt, likes"],
    ["order=up", "order must be asc or desc"],
  ]) {
    const res = await fetch(`${BASE}/posts?${q}`);
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(await res.json(), { error: expectedErr });
  }
  console.log("✓ Lab 2 Step 07 pagination & sorting passed");

  console.log("\n>>> [LAB 2] Testing Step 08: Filtering on GET /posts");
  // 1. Case-insensitive location
  const pLocGoa = await (await fetch(`${BASE}/posts?location=GOA`)).json();
  assert.deepStrictEqual(pLocGoa.data.map(getInstaId), ["insta23", "insta16", "insta10", "insta01"]);
  assert.strictEqual(pLocGoa.meta.total, 4);

  // 2. Case-insensitive caption search
  const pSearchSunset = await (await fetch(`${BASE}/posts?search=sunset`)).json();
  assert.deepStrictEqual(pSearchSunset.data.map(getInstaId), ["insta20", "insta08", "insta01"]);
  assert.strictEqual(pSearchSunset.meta.total, 3);

  // 3. Date range from & to (March)
  const pDateMarch = await (
    await fetch(`${BASE}/posts?from=2026-03-01&to=2026-04-01`)
  ).json();
  assert.strictEqual(pDateMarch.data.length, 8);
  assert.strictEqual(getInstaId(pDateMarch.data[0]), "insta16");
  assert.strictEqual(getInstaId(pDateMarch.data[7]), "insta09");
  assert.strictEqual(pDateMarch.meta.total, 8);

  // 4. from only (April onwards)
  const pDateApril = await (await fetch(`${BASE}/posts?from=2026-04-01`)).json();
  assert.strictEqual(pDateApril.data.length, 8);
  assert.strictEqual(getInstaId(pDateApril.data[0]), "insta24");
  assert.strictEqual(getInstaId(pDateApril.data[7]), "insta17");
  assert.strictEqual(pDateApril.meta.total, 8);

  // 5. location=pune&search=CHAI
  const pPuneChai = await (await fetch(`${BASE}/posts?location=pune&search=CHAI`)).json();
  assert.deepStrictEqual(pPuneChai.data.map(getInstaId), ["insta15"]);
  assert.strictEqual(pPuneChai.meta.total, 1);

  // 6. location=mumbai&limit=2&page=2
  const pMumbaiP2 = await (
    await fetch(`${BASE}/posts?location=mumbai&limit=2&page=2`)
  ).json();
  assert.deepStrictEqual(pMumbaiP2.data.map(getInstaId), ["insta06", "insta02"]);
  assert.deepStrictEqual(pMumbaiP2.meta, { page: 2, limit: 2, total: 4, totalPages: 2 });

  // 7. Invalid date (400)
  const pInvalidDate = await fetch(`${BASE}/posts?from=yesterday`);
  assert.strictEqual(pInvalidDate.status, 400);
  assert.deepStrictEqual(await pInvalidDate.json(), { error: "from and to must be valid dates" });
  console.log("✓ Lab 2 Step 08 filtering passed");

  // =================================================================
  // PART 3: LAB 3 - RELATIONS, SEEDING, LIKES, CASCADES & LIKED-POSTS
  // =================================================================
  console.log("\n=================================================================");
  console.log(">>> [LAB 3] Testing Step 04: POST /posts needs an author");
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
  console.log("✓ Lab 3 Step 04 tests passed");

  // Re-seed for clean state
  await runCommand("node", ["prisma/seed.js"]);
  riya = await getUserByUsername("riya_travels");
  arjun = await getUserByUsername("arjun_clicks");
  const dev = await getUserByUsername("dev_shoots");
  const aditya = await getUserByUsername("aditya_codes");
  p01 = await getPostByPattern("insta01");
  const p05 = await getPostByPattern("insta05");
  const p24 = await getPostByPattern("insta24");

  console.log("\n>>> [LAB 3] Testing Step 05: GET /posts/:id with author and like count");
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
  console.log("✓ Lab 3 Step 05 tests passed");

  console.log("\n>>> [LAB 3] Testing Step 06: GET /posts with authors, like counts and sortBy=likes");
  const s6_1 = await (await fetch(`${BASE}/posts?limit=2`)).json();
  assert.strictEqual(getInstaId(s6_1.data[0]), "insta24");
  assert.strictEqual(s6_1.data[0].author.username, "dev_shoots");
  assert.deepStrictEqual(s6_1.data[0]._count, { likes: 6 });
  assert.strictEqual(getInstaId(s6_1.data[1]), "insta23");
  assert.strictEqual(s6_1.data[1].author.username, "riya_travels");
  assert.deepStrictEqual(s6_1.data[1]._count, { likes: 0 });

  const s6_2 = await (await fetch(`${BASE}/posts?sortBy=likes&limit=5`)).json();
  assert.deepStrictEqual(s6_2.data.map(getInstaId), [
    "insta24",
    "insta01",
    "insta15",
    "insta10",
    "insta08",
  ]);

  const s6_3 = await (await fetch(`${BASE}/posts?sortBy=likes&order=asc&limit=3`)).json();
  assert.deepStrictEqual(s6_3.data.map(getInstaId), ["insta23", "insta21", "insta19"]);

  const s6_4 = await (await fetch(`${BASE}/posts?location=goa&sortBy=likes`)).json();
  assert.deepStrictEqual(s6_4.data.map(getInstaId), ["insta01", "insta10", "insta23", "insta16"]);
  assert.strictEqual(s6_4.meta.total, 4);

  const s6_5 = await fetch(`${BASE}/posts?sortBy=comments`);
  assert.strictEqual(s6_5.status, 400);
  assert.deepStrictEqual(await s6_5.json(), {
    error: "sortBy must be one of: createdAt, updatedAt, likes",
  });
  console.log("✓ Lab 3 Step 06 tests passed");

  console.log("\n>>> [LAB 3] Testing Step 07: GET /users/:id with counts and hasPosts filter");
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
  assert.deepStrictEqual(s7_6.data.map((u) => u.username), [
    "dev_shoots",
    "ananya_reads",
    "meera.eats",
  ]);

  const s7_7 = await fetch(`${BASE}/users?hasPosts=yes`);
  assert.strictEqual(s7_7.status, 400);
  assert.deepStrictEqual(await s7_7.json(), { error: "hasPosts must be true or false" });
  console.log("✓ Lab 3 Step 07 tests passed");

  console.log("\n>>> [LAB 3] Testing Step 08: GET /users/:id/posts");
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
  assert.deepStrictEqual(await s8_5.json(), {
    error: "page and limit must be positive integers",
  });
  console.log("✓ Lab 3 Step 08 tests passed");

  console.log("\n>>> [LAB 3] Testing Step 09: GET /posts/:id/likes");
  const s9_1 = await (await fetch(`${BASE}/posts/${p01.id}/likes`)).json();
  assert.deepStrictEqual(s9_1.map((u) => u.username), [
    "arjun_clicks",
    "isha_dances",
    "meera.eats",
    "neha_designs",
    "vikram.trek",
  ]);
  assert.strictEqual(s9_1[0].email, undefined);

  const s9_2 = await (await fetch(`${BASE}/posts/${p24.id}/likes`)).json();
  assert.deepStrictEqual(s9_2.map((u) => u.username), [
    "aditya_codes",
    "arjun_clicks",
    "riya_travels",
    "rohan_runs",
    "sara_sketches",
    "vikram.trek",
  ]);

  const s9_3 = await (await fetch(`${BASE}/posts/${p05.id}/likes`)).json();
  assert.deepStrictEqual(s9_3, []);

  const s9_4 = await fetch(`${BASE}/posts/999999/likes`);
  assert.strictEqual(s9_4.status, 404);
  assert.deepStrictEqual(await s9_4.json(), { error: "Post not found" });
  console.log("✓ Lab 3 Step 09 tests passed");

  console.log("\n>>> [LAB 3] Testing Step 10: Like and Unlike");
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
  console.log("✓ Lab 3 Step 10 tests passed");

  console.log("\n>>> [LAB 3] Testing Step 11: Cascading Deletes");
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
  assert.deepStrictEqual(s11_6.map((u) => u.username), [
    "aditya_codes",
    "arjun_clicks",
    "rohan_runs",
    "sara_sketches",
    "vikram.trek",
  ]);

  const s11_7 = await (await fetch(`${BASE}/users/${arjunBeforeDel.id}`)).json();
  assert.deepStrictEqual(s11_7._count, { posts: 4, likes: 2 });

  const s11_8 = await fetch(`${BASE}/users/${riyaBeforeDel.id}/posts`);
  assert.strictEqual(s11_8.status, 404);
  assert.deepStrictEqual(await s11_8.json(), { error: "User not found" });
  console.log("✓ Lab 3 Step 11 tests passed");

  // Re-seed after Step 11
  await runCommand("node", ["prisma/seed.js"]);

  console.log("\n>>> [LAB 3] Testing Step 12: GET /users/:id/liked-posts");
  const riyaAfterSeed = await getUserByUsername("riya_travels");
  const arjunAfterSeed = await getUserByUsername("arjun_clicks");
  const nehaAfterSeed = await getUserByUsername("neha_designs");

  const s12_1 = await (await fetch(`${BASE}/users/${riyaAfterSeed.id}/liked-posts`)).json();
  assert.deepStrictEqual(s12_1.data.map(getInstaId), [
    "insta24",
    "insta20",
    "insta10",
    "insta03",
  ]);
  assert.deepStrictEqual(s12_1.meta, { page: 1, limit: 10, total: 4, totalPages: 1 });
  assert.strictEqual(s12_1.data[0].author.email, undefined);
  assert(s12_1.data[0]._count && s12_1.data[0]._count.likes !== undefined);

  const s12_2 = await (
    await fetch(`${BASE}/users/${arjunAfterSeed.id}/liked-posts?limit=2`)
  ).json();
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
  console.log("✓ Lab 3 Step 12 tests passed");

  // Re-seed final
  await runCommand("node", ["prisma/seed.js"]);

  console.log("\n=================================================================");
  console.log("🎉 ALL TESTS FOR LAB 1, LAB 2 & LAB 3 PASSED SUCCESSFULLY! 🎉");
  console.log("=================================================================\n");
  await prisma.$disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  await prisma.$disconnect();
  process.exit(1);
});
