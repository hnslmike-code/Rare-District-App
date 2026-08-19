import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import sharp from "sharp";
import { db, mediaAssetsTable, mediaDerivativesTable, mediaModerationTable, mediaVersionsTable, mediaPlacementsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const MAX_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const sizes = { thumbnail: 320, card: 640, gallery: 1400, square: 900, portrait: 1000 } as const;

function isOwner(req: any, asset: typeof mediaAssetsTable.$inferSelect) {
  return req.user?.role === "admin" || asset.ownerId === req.user?.userId;
}

async function uploadDerivative(data: Buffer, contentType: string) {
  const uploadURL = await storage.getObjectEntityUploadURL();
  const objectPath = storage.normalizeObjectEntityPath(uploadURL);
  const response = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: data });
  if (!response.ok) throw new Error("Derivative upload failed");
  return objectPath;
}

router.post("/media/uploads/request", requireAuth, async (req, res): Promise<void> => {
  const { name, size, contentType, surface = "product_gallery", altText } = req.body ?? {};
  if (typeof name !== "string" || !Number.isInteger(size) || size < 1 || size > MAX_BYTES || !allowedTypes.has(contentType)) {
    res.status(400).json({ error: "JPEG, PNG, or WebP images up to 10MB are supported." }); return;
  }
  const uploadURL = await storage.getObjectEntityUploadURL();
  const objectPath = storage.normalizeObjectEntityPath(uploadURL);
  const [asset] = await db.insert(mediaAssetsTable).values({
    ownerId: req.user!.userId, ownerType: "user", surface: String(surface).slice(0, 80),
    originalName: name.slice(0, 255), altText: typeof altText === "string" ? altText.slice(0, 240) : null,
  }).returning();
  const [version] = await db.insert(mediaVersionsTable).values({
    assetId: asset.id, version: 1, sourceObjectPath: objectPath, contentType, bytes: size,
    originalExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  }).returning();
  await db.update(mediaAssetsTable).set({ activeVersionId: version.id }).where(eq(mediaAssetsTable.id, asset.id));
  res.status(201).json({ mediaId: asset.id, versionId: version.id, uploadURL, objectPath, expiresIn: 900 });
});

router.post("/media/:id/finalize", requireAuth, async (req, res): Promise<void> => {
  const assetId = Number(req.params.id);
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, assetId));
  if (!asset || !isOwner(req, asset)) { res.status(404).json({ error: "Media asset not found." }); return; }
  const [version] = await db.select().from(mediaVersionsTable).where(and(eq(mediaVersionsTable.assetId, assetId), eq(mediaVersionsTable.id, asset.activeVersionId!)));
  if (!version) { res.status(409).json({ error: "Upload version is missing." }); return; }
  try {
    const file = await storage.getObjectEntityFile(version.sourceObjectPath);
    const [metadata, input] = await Promise.all([file.getMetadata(), file.download()]);
    if (!allowedTypes.has(String(metadata.contentType)) || Number(metadata.size) > MAX_BYTES) throw new Error("Unsupported or oversized image.");
    const info = await sharp(input).metadata();
    if (!info.width || !info.height || !["jpeg", "png", "webp"].includes(info.format ?? "")) throw new Error("The uploaded file is not a valid supported image.");
    const derivativeRows = [];
    for (const [kind, width] of Object.entries(sizes)) {
      const pipeline = sharp(input).resize({ width, withoutEnlargement: true, fit: kind === "square" ? "cover" : "inside" });
      const output = await pipeline.webp({ quality: 86 }).toBuffer();
      const outputInfo = await sharp(output).metadata();
      const objectPath = await uploadDerivative(output, "image/webp");
      derivativeRows.push({ versionId: version.id, kind: kind as keyof typeof sizes, objectPath, bytes: output.length, width: outputInfo.width ?? width, height: outputInfo.height ?? width });
    }
    await db.transaction(async tx => {
      await tx.delete(mediaDerivativesTable).where(eq(mediaDerivativesTable.versionId, version.id));
      await tx.insert(mediaDerivativesTable).values(derivativeRows);
      await tx.update(mediaAssetsTable).set({ status: "ready", visibility: "private" }).where(eq(mediaAssetsTable.id, assetId));
      await tx.update(mediaVersionsTable).set({ width: info.width, height: info.height, bytes: Number(metadata.size) }).where(eq(mediaVersionsTable.id, version.id));
      await tx.insert(mediaModerationTable).values({ assetId, status: "clear", flags: [] });
    });
    const derivatives = await db.select().from(mediaDerivativesTable).where(eq(mediaDerivativesTable.versionId, version.id));
    res.json({ assetId, status: "ready", width: info.width, height: info.height, derivatives });
  } catch (error) {
    await db.update(mediaAssetsTable).set({ status: "failed" }).where(eq(mediaAssetsTable.id, assetId));
    res.status(422).json({ error: error instanceof Error ? error.message : "Image processing failed." });
  }
});

router.get("/media/:id", requireAuth, async (req, res): Promise<void> => {
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, Number(req.params.id)));
  if (!asset || !isOwner(req, asset)) { res.status(404).json({ error: "Media asset not found." }); return; }
  const versions = await db.select().from(mediaVersionsTable).where(eq(mediaVersionsTable.assetId, asset.id)).orderBy(desc(mediaVersionsTable.version));
  const derivatives = versions.length ? await db.select().from(mediaDerivativesTable).where(eq(mediaDerivativesTable.versionId, versions[0].id)) : [];
  res.json({ asset, versions, derivatives });
});

router.post("/media/:id/placement", requireAuth, async (req, res): Promise<void> => {
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, Number(req.params.id)));
  if (!asset || !isOwner(req, asset) || asset.status !== "ready") { res.status(404).json({ error: "Ready media asset not found." }); return; }
  const { entityType, entityId, slot, sortOrder = 0, focalX, focalY, cropShape } = req.body ?? {};
  if (typeof entityType !== "string" || !Number.isInteger(Number(entityId))) { res.status(400).json({ error: "A placement target is required." }); return; }
  const [placement] = await db.insert(mediaPlacementsTable).values({ assetId: asset.id, entityType, entityId: Number(entityId), slot: typeof slot === "string" ? slot : null, sortOrder: Number(sortOrder), focalX: Number.isInteger(focalX) ? focalX : null, focalY: Number.isInteger(focalY) ? focalY : null, cropShape: typeof cropShape === "string" ? cropShape : null }).returning();
  res.status(201).json(placement);
});

export default router;