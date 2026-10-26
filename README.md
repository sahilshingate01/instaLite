# InstaLite API

A modular, production-ready RESTful backend API for an Instagram-like platform built with **Node.js**, **Express**, **Prisma ORM**, and **PostgreSQL**.

---

## Features

- **MVC Architecture**: Clean separation of concerns with isolated Routes, Controllers, and Services.
- **Relational Data Modeling**:
  - `User` &rarr; `Post`: One-to-many relationship with `onDelete: Cascade`.
  - `User` &harr; `Post`: Explicit many-to-many relationship via `Like` table with composite primary key `@@id([userId, postId])` and cascading deletes.
- **Advanced Querying**:
  - **Pagination**: Offset-based pagination with customizable `page` and `limit` (capped at 50) and comprehensive metadata (`page`, `limit`, `total`, `totalPages`).
  - **Sorting**: Multi-column sorting (`createdAt`, `username`, `fullname`, `updatedAt`, `likes`) with tie-breakers.
  - **Filtering**: Case-insensitive substring searches, boolean filters (`isPrivate`, `hasPosts`), location filtering, and ISO date ranges (`from`, `to`).
- **Single-Transaction Queries**: Pagination records and total counts fetched atomically using Prisma transactions.
- **Privacy by Design**: Sensitive user fields (like `email`) are omitted in nested user summary projections (`{ id, username, fullname }`).
- **Idempotent Database Seeding**: Pre-configured seed script with 12 realistic users, 24 posts, and 29 likes.
- **Comprehensive Automated Test Suite**: Full coverage for CRUD operations, pagination, filtering, relations, like/unlike operations, and cascading deletes.

---

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **ORM**: Prisma (v7+) with `@prisma/adapter-pg`
- **Database**: PostgreSQL
- **Testing**: Built-in test runner (`test-all.js`) using native Node.js assertions and fetch

---

## Project Structure

```txt
instaLite/
├── prisma/
│   ├── migrations/          # Prisma database migrations
│   ├── schema.prisma        # Database schema definitions
│   ├── seed-data.js         # Seed data (12 users, 24 posts, 29 likes)
│   └── seed.js              # Database seed script
├── src/
│   ├── controllers/         # Request handling & input validation
│   │   ├── likes.controller.js
│   │   ├── posts.controller.js
│   │   └── users.controller.js
│   ├── routes/              # Route definitions
│   │   ├── posts.routes.js
│   │   └── users.routes.js
│   ├── services/            # Database queries (Prisma)
│   │   ├── likes.service.js
│   │   ├── posts.service.js
│   │   └── users.service.js
│   ├── utils/               # Shared helpers (pagination parser & meta)
│   │   └── pagination.js
│   ├── db.js                # Singleton Prisma Client with pg adapter
│   └── index.js             # Express application entrypoint
├── .env                     # Environment variables (DATABASE_URL)
├── package.json             # Scripts & dependencies
├── prisma.config.js         # Prisma configuration (seed command)
└── test-all.js              # End-to-end automated test suite
```

---

## Database Models

### `User`
| Field       | Type      | Attributes                                |
| ----------- | --------- | ----------------------------------------- |
| `id`        | `Int`     | Primary Key, Auto-increment               |
| `username`  | `String`  | Unique                                    |
| `email`     | `String`  | Unique                                    |
| `fullname`  | `String`  | Required                                  |
| `bio`       | `String?` | Optional                                  |
| `isPrivate` | `Boolean` | Default: `false`                          |
| `createdAt` | `DateTime`| Default: `now()`                          |
| `updatedAt` | `DateTime`| Updated automatically                     |
| `posts`     | `Post[]`  | One-to-many relation                      |
| `likes`     | `Like[]`  | Many-to-many relation                     |

### `Post`
| Field       | Type      | Attributes                                |
| ----------- | --------- | ----------------------------------------- |
| `id`        | `Int`     | Primary Key, Auto-increment               |
| `imageUrl`  | `String`  | Required                                  |
| `caption`   | `String?` | Optional                                  |
| `location`  | `String?` | Optional                                  |
| `authorId`  | `Int`     | Foreign Key (`User.id`), Cascade on Delete|
| `author`    | `User`    | Relation field                            |
| `createdAt` | `DateTime`| Default: `now()`                          |
| `updatedAt` | `DateTime`| Updated automatically                     |
| `likes`     | `Like[]`  | Many-to-many relation                     |

### `Like`
| Field       | Type      | Attributes                                |
| ----------- | --------- | ----------------------------------------- |
| `userId`    | `Int`     | Foreign Key (`User.id`), Cascade on Delete|
| `postId`    | `Int`     | Foreign Key (`Post.id`), Cascade on Delete|
| `createdAt` | `DateTime`| Default: `now()`                          |

- **Primary Key**: Composite `@@id([userId, postId])`
- **Indices**: `@@index([postId])`

---

## API Endpoints

### Health Check

| Method | Endpoint  | Description               | Response Format |
| ------ | --------- | ------------------------- | --------------- |
| `GET`  | `/health` | Server health check probe | `{ "status": "OK" }` |

---

### Users (`/users`)

| Method   | Endpoint                | Description                                | Query Parameters / Body |
| -------- | ----------------------- | ------------------------------------------ | ----------------------- |
| `POST`   | `/users`                | Create user (`201`)                        | Body: `{ username, email, fullname, bio? }` |
| `GET`    | `/users`                | List users with pagination/sort/filter     | `page`, `limit`, `sortBy`, `order`, `isPrivate`, `hasPosts`, `search` |
| `GET`    | `/users/:id`            | Get user by ID with post and like counts   | - |
| `PATCH`  | `/users/:id`            | Update user details                        | Body: `{ fullname?, bio?, isPrivate? }` |
| `DELETE` | `/users/:id`            | Delete user (cascades to posts & likes)    | - |
| `GET`    | `/users/:id/posts`      | List user's posts (paginated)              | `page`, `limit` |
| `GET`    | `/users/:id/liked-posts`| List posts liked by this user (paginated)  | `page`, `limit` |

---

### Posts (`/posts`)

| Method   | Endpoint                       | Description                               | Query Parameters / Body |
| -------- | ------------------------------ | ----------------------------------------- | ----------------------- |
| `POST`   | `/posts`                       | Create post (`201`)                       | Body: `{ imageUrl, authorId, caption?, location? }` |
| `GET`    | `/posts`                       | List posts with author & likes            | `page`, `limit`, `sortBy`, `order`, `location`, `search`, `from`, `to` |
| `GET`    | `/posts/:id`                   | Get post with author summary & like count | - |
| `PATCH`  | `/posts/:id`                   | Update post details                       | Body: `{ caption?, location? }` |
| `DELETE` | `/posts/:id`                   | Delete post (cascades to likes)           | - |
| `GET`    | `/posts/:id/likes`             | List user summaries of likes on this post | - |
| `POST`   | `/posts/:id/likes`             | Like a post (`201`)                       | Body: `{ userId }` |
| `DELETE` | `/posts/:id/likes/:userId`     | Unlike a post (`204`)                     | - |

---

## Standard Response Shapes

### 1. Paginated Response (`GET /users`, `GET /posts`, etc.)
```json
{
  "data": [
    { ... }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 12,
    "totalPages": 2
  }
}
```

### 2. User Summary Shape (Nested inside Posts & Likes)
To prevent leaking sensitive details such as `email`, user summaries expose only non-sensitive identifiers:
```json
{
  "id": 1,
  "username": "riya_travels",
  "fullname": "Riya Sharma"
}
```

### 3. Post with Counts
```json
{
  "id": 1,
  "imageUrl": "https://picsum.photos/seed/insta01/600/600",
  "caption": "Sunset at Baga beach 🌅",
  "location": "Goa",
  "authorId": 1,
  "createdAt": "2026-02-01T18:30:00.000Z",
  "updatedAt": "2026-02-01T18:30:00.000Z",
  "author": {
    "id": 1,
    "username": "riya_travels",
    "fullname": "Riya Sharma"
  },
  "_count": {
    "likes": 5
  }
}
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/) database

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/sahilshingate01/instaLite.git
cd instaLite
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?schema=public"
```

### 3. Run Database Migrations
Apply the migrations to set up your PostgreSQL database schema:
```bash
npx prisma migrate dev
```

### 4. Seed Database
Wipes and populates the database with 12 users, 24 posts, and 29 likes:
```bash
npm run seed
```

### 5. Start the Server
```bash
npm start
```
The server will start on port `3000`:
```txt
Server started on port 3000
```

---

## Running Automated Tests

Run the complete test suite covering all CRUD endpoints, validation, pagination, filtering, sorting, relations, likes, and cascading deletes:
```bash
npm test
```

---

## License

ISC
