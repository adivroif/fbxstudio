import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize R2 Client (S3 compatible)
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure uploads directory exists
  const uploadDir = path.join(__dirname, "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Configure multer for file storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  });

  const upload = multer({ storage });

  // API Route for file uploads
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    // Return the URL to the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // API Route for listing R2 files
  app.get("/api/r2/files", async (req, res) => {
    try {
      if (!process.env.R2_BUCKET_NAME) {
        return res.status(400).json({ error: "R2 bucket name not configured" });
      }

      const command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
      });

      const response = await r2Client.send(command);
      
      // Filter for FBX files and generate proxy URLs
      const files = (response.Contents || [])
        .filter(obj => obj.Key?.toLowerCase().endsWith(".fbx"))
        .map((obj) => {
          return {
            key: obj.Key,
            name: obj.Key?.split("/").pop() || "Unknown",
            size: obj.Size,
            lastModified: obj.LastModified,
            // Use our proxy endpoint instead of a direct signed URL to avoid CORS issues
            url: `/api/r2/proxy?key=${encodeURIComponent(obj.Key || "")}`
          };
        });

      res.json({ files });
    } catch (error: any) {
      console.error("Error listing R2 files:", error);
      res.status(500).json({ error: "Failed to list R2 files", details: error.message });
    }
  });

  // API Route for listing R2 textures (images)
  app.get("/api/r2/textures", async (req, res) => {
    try {
      if (!process.env.R2_BUCKET_NAME) {
        return res.status(400).json({ error: "R2 bucket name not configured" });
      }

      const command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        // Optional: filter by prefix if the user keeps textures in an 'images/' folder
        // Prefix: "images/" 
      });

      const response = await r2Client.send(command);
      
      // Filter for image files
      const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".tga", ".dds"];
      const textures = (response.Contents || [])
        .filter(obj => imageExtensions.some(ext => obj.Key?.toLowerCase().endsWith(ext)))
        .map((obj) => {
          return {
            key: obj.Key,
            name: obj.Key?.split("/").pop() || "Unknown",
            url: `/api/r2/proxy?key=${encodeURIComponent(obj.Key || "")}`
          };
        });

      res.json({ textures });
    } catch (error: any) {
      console.error("Error listing R2 textures:", error);
      res.status(500).json({ error: "Failed to list R2 textures", details: error.message });
    }
  });

  // Proxy route to fetch files from R2 and serve them from our domain (bypasses CORS)
  app.get("/api/r2/proxy", async (req, res) => {
    const key = req.query.key as string;
    if (!key) return res.status(400).send("Key is required");

    try {
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      });

      const response = await r2Client.send(command);
      
      if (response.ContentType) {
        res.setHeader("Content-Type", response.ContentType);
      }
      if (response.ContentLength) {
        res.setHeader("Content-Length", response.ContentLength);
      }

      // Stream the body to the response
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
