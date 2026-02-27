---
title: Multipart & File Uploads
impact: HIGH
impactDescription: Secure, memory-safe file upload handling for production applications
tags: multipart, file-upload, stream, form-data, mime, validation
---

## Multipart & File Uploads

File uploads require special handling that differs from JSON request bodies. Use `@fastify/multipart` for parsing `multipart/form-data` requests. Always set file size and count limits, validate file types, and prefer streaming for large files to avoid memory exhaustion.

### Setup `@fastify/multipart` as a Plugin

**Incorrect (manual content-type parsing):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.addContentTypeParser(
  "multipart/form-data",
  function (request, payload, done) {
    // Manual multipart parsing is error-prone and insecure
    let data = "";
    payload.on("data", (chunk) => {
      data += chunk;
    });
    payload.on("end", () => {
      done(null, data);
    });
  },
);
```

**Correct (register `@fastify/multipart` as a shared plugin):**

```bash
npm install @fastify/multipart
```

`src/plugins/multipart.ts`

```ts
import fp from "fastify-plugin";
import multipart from "@fastify/multipart";

async function multipartPlugin(fastify) {
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB per file
      files: 5, // max 5 files per request
      fields: 10, // max 10 non-file fields
    },
  });
}

export default fp(multipartPlugin, {
  name: "multipart",
  fastify: "5.x",
});
```

### Handle a Single File Upload

**Incorrect (buffering entire file into memory):**

```ts
server.post("/upload", async (request) => {
  const body = request.body as any;
  const fileBuffer = Buffer.from(body.file, "binary");
  // Unbounded memory usage — large files crash the process
  await writeFile("/uploads/" + body.filename, fileBuffer);
  return { status: "ok" };
});
```

**Correct (use `request.file()` to get a single file):**

`src/routes/uploads/index.ts`

```ts
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

async function uploadRoutes(fastify) {
  fastify.post("/", async (request, reply) => {
    const file = await request.file();

    if (!file) {
      reply.status(400);
      return { error: "No file uploaded" };
    }

    const filename = `${randomUUID()}-${file.filename}`;
    const destination = join("/uploads", filename);

    await pipeline(file.file, createWriteStream(destination));

    // Check if the stream was truncated (file exceeded size limit)
    if (file.file.truncated) {
      reply.status(413);
      return { error: "File too large" };
    }

    return { filename, mimetype: file.mimetype, destination };
  });
}

export default uploadRoutes;
```

### Handle Multiple File Uploads

**Correct (use `request.files()` to iterate over all files):**

```ts
async function multiUploadRoutes(fastify) {
  fastify.post("/batch", async (request, reply) => {
    const results = [];

    const files = request.files();
    for await (const file of files) {
      const filename = `${randomUUID()}-${file.filename}`;
      const destination = join("/uploads", filename);

      await pipeline(file.file, createWriteStream(destination));

      if (file.file.truncated) {
        reply.status(413);
        return { error: `File ${file.filename} too large` };
      }

      results.push({ filename, mimetype: file.mimetype });
    }

    if (results.length === 0) {
      reply.status(400);
      return { error: "No files uploaded" };
    }

    return { uploaded: results };
  });
}

export default multiUploadRoutes;
```

### Combine File Fields with Regular Form Fields

**Correct (use `request.parts()` to handle mixed multipart data):**

```ts
async function profileRoutes(fastify) {
  fastify.post("/profile", async (request, reply) => {
    const parts = request.parts();
    let avatarPath: string | undefined;
    const fields: Record<string, string> = {};

    for await (const part of parts) {
      if (part.type === "file") {
        const filename = `${randomUUID()}-${part.filename}`;
        avatarPath = join("/uploads/avatars", filename);
        await pipeline(part.file, createWriteStream(avatarPath));

        if (part.file.truncated) {
          reply.status(413);
          return { error: "Avatar file too large" };
        }
      } else {
        // part.type === 'field'
        fields[part.fieldname] = part.value as string;
      }
    }

    return updateProfile({
      name: fields.name,
      bio: fields.bio,
      avatar: avatarPath,
    });
  });
}

export default profileRoutes;
```

### Validate File Types

**Correct (check MIME type and file extension before processing):**

```ts
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

async function validatedUploadRoutes(fastify) {
  fastify.post("/documents", async (request, reply) => {
    const file = await request.file();

    if (!file) {
      reply.status(400);
      return { error: "No file uploaded" };
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      // Consume the stream to avoid hanging the request
      await file.toBuffer();
      reply.status(415);
      return {
        error: `Unsupported file type: ${file.mimetype}`,
        allowed: [...ALLOWED_MIME_TYPES],
      };
    }

    // Validate file extension
    const ext = file.filename.slice(file.filename.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      await file.toBuffer();
      reply.status(415);
      return { error: `Unsupported file extension: ${ext}` };
    }

    const filename = `${randomUUID()}${ext}`;
    const destination = join("/uploads/documents", filename);
    await pipeline(file.file, createWriteStream(destination));

    if (file.file.truncated) {
      reply.status(413);
      return { error: "File too large" };
    }

    return { filename, mimetype: file.mimetype };
  });
}

export default validatedUploadRoutes;
```

### Process Files In-Memory (Small Files Only)

When you need the file content directly (e.g., parsing a CSV or processing an image), use `toBuffer()` instead of streaming to disk. Only use this for files within a small size limit.

**Correct (use `toBuffer()` for small in-memory processing):**

```ts
async function importRoutes(fastify) {
  // Override the file size limit for this route
  fastify.post(
    "/import/csv",
    { config: { limits: { fileSize: 2 * 1024 * 1024 } } },
    async (request, reply) => {
      const file = await request.file();

      if (!file || file.mimetype !== "text/csv") {
        reply.status(400);
        return { error: "A CSV file is required" };
      }

      const buffer = await file.toBuffer();

      if (file.file.truncated) {
        reply.status(413);
        return { error: "CSV file too large (max 2 MB)" };
      }

      const csvContent = buffer.toString("utf-8");
      const records = parseCsv(csvContent);

      return { imported: records.length };
    },
  );
}

export default importRoutes;
```

### Add TypeScript Support

**Correct (augment Fastify types for multipart):**

```ts
import type {
  MultipartFile,
  MultipartValue,
} from "@fastify/multipart";

declare module "fastify" {
  interface FastifyRequest {
    file: () => Promise<MultipartFile | undefined>;
    files: (
      options?: { limits?: { fileSize?: number } },
    ) => AsyncIterableIterator<MultipartFile>;
    parts: () => AsyncIterableIterator<MultipartFile | MultipartValue>;
  }
}
```

### Testing File Uploads

**Correct (test uploads with `inject()` and FormData):**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import FormData from "form-data";
import buildServer from "../../src/server.js";

describe("file uploads", () => {
  let server;

  beforeAll(async () => {
    server = buildServer({ logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it("uploads a single file", async () => {
    const form = new FormData();
    form.append("file", Buffer.from("hello world"), {
      filename: "test.txt",
      contentType: "text/plain",
    });

    const response = await server.inject({
      method: "POST",
      url: "/uploads",
      payload: form,
      headers: form.getHeaders(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("filename");
  });

  it("rejects requests with no file", async () => {
    const form = new FormData();
    form.append("name", "test");

    const response = await server.inject({
      method: "POST",
      url: "/uploads",
      payload: form,
      headers: form.getHeaders(),
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects unsupported file types", async () => {
    const form = new FormData();
    form.append("file", Buffer.from("not an image"), {
      filename: "test.exe",
      contentType: "application/x-msdownload",
    });

    const response = await server.inject({
      method: "POST",
      url: "/documents",
      payload: form,
      headers: form.getHeaders(),
    });

    expect(response.statusCode).toBe(415);
  });
});
```

Reference: [@fastify/multipart](https://github.com/fastify/fastify-multipart) | [Fastify Content-Type Parser](https://fastify.dev/docs/latest/Reference/ContentTypeParser/)
