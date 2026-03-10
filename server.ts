import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  NODE_ENV,
} = process.env;

// Initialize R2 Client (S3 compatible)
const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ACCOUNT_ID
    ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Ensure uploads directory exists
  const uploadDir = path.join(__dirname, "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Configure multer for file storage
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
  });

  const upload = multer({ storage });

  // Simple health check
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      environment: NODE_ENV || "development",
      hasR2Config: Boolean(
        R2_ACCOUNT_ID &&
          R2_ACCESS_KEY_ID &&
          R2_SECRET_ACCESS_KEY &&
          R2_BUCKET_NAME
      ),
    });
  });

  // API Route for file uploads
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({ url: fileUrl });
  });

  // API Route for listing R2 files
  app.get("/api/r2/files", async (_req, res) => {
    try {
      if (!R2_BUCKET_NAME) {
        return res.status(400).json({ error: "R2 bucket name not configured" });
      }

      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
      });

      const response = await r2Client.send(command);

      const files = (response.Contents || [])
        .filter((obj) => obj.Key?.toLowerCase().endsWith(".fbx"))
        .map((obj) => ({
          key: obj.Key,
          name: obj.Key?.split("/").pop() || "Unknown",
          size: obj.Size,
          lastModified: obj.LastModified,
          url: `/api/r2/proxy?key=${encodeURIComponent(obj.Key || "")}`,
        }));

      return res.json({ files });
    } catch (error: any) {
      console.error("Error listing R2 files:", error);
      return res.status(500).json({
        error: "Failed to list R2 files",
        details: error?.message || "Unknown error",
      });
    }
  });

  // API Route for listing R2 textures (images)
  app.get("/api/r2/textures", async (_req, res) => {
    try {
      if (!R2_BUCKET_NAME) {
        return res.status(400).json({ error: "R2 bucket name not configured" });
      }

      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
      });

      const response = await r2Client.send(command);

      const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".tga", ".dds"];
      const textures = (response.Contents || [])
        .filter((obj) =>
          imageExtensions.some((ext) => obj.Key?.toLowerCase().endsWith(ext))
        )
        .map((obj) => ({
          key: obj.Key,
          name: obj.Key?.split("/").pop() || "Unknown",
          url: `/api/r2/proxy?key=${encodeURIComponent(obj.Key || "")}`,
        }));

      return res.json({ textures });
    } catch (error: any) {
      console.error("Error listing R2 textures:", error);
      return res.status(500).json({
        error: "Failed to list R2 textures",
        details: error?.message || "Unknown error",
      });
    }
  });

  // Proxy route to fetch files from R2 and serve them from our domain
  app.get("/api/r2/proxy", async (req, res) => {
    const key = req.query.key as string;

    if (!key) {
      return res.status(400).send("Key is required");
    }

    if (!R2_BUCKET_NAME) {
      return res.status(400).send("R2 bucket name not configured");
    }

    try {
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });

      const response = await r2Client.send(command);

      if (response.ContentType) {
        res.setHeader("Content-Type", response.ContentType);
      }

      if (response.ContentLength) {
        res.setHeader("Content-Length", response.ContentLength.toString());
      }

      const body = response.Body as any;
      if (body) {
        body.pipe(res);
      } else {
        res.status(404).send("File body not found");
      }
    } catch (error: any) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to proxy file");
    }
  });

  // Serve uploaded files statically
  app.use("/uploads", express.static(uploadDir));

  // Development: use Vite middleware
  if (NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    // Production: serve built frontend
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));

    app.get("/{*any}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});