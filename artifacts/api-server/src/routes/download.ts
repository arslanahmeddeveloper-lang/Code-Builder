import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import axios from "axios";
import { extractVideo } from "../services/scraper";
import { DownloadVideoBody, ProxyVideoQueryParams } from "@workspace/api-zod";

const router = Router();

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { status: "error", message: "Too many requests. Please wait a minute before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/download", downloadLimiter, async (req, res) => {
  const parseResult = DownloadVideoBody.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid request. Please provide a valid Kuaishou URL.",
    });
  }

  const { url } = parseResult.data;

  try {
    const videoInfo = await extractVideo(url);
    return res.json({
      status: "success",
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      video_url: videoInfo.video_url,
      quality: videoInfo.quality,
      author: videoInfo.author,
      duration: videoInfo.duration,
      cached: videoInfo.cached ?? false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to extract video. Please try again.";
    req.log.error({ err, url }, "Failed to extract video");

    if (message.includes("Invalid URL")) {
      return res.status(400).json({ status: "error", message });
    }
    if (message.includes("private") || message.includes("not found") || message.includes("deleted")) {
      return res.status(404).json({ status: "error", message });
    }
    return res.status(500).json({ status: "error", message });
  }
});

const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { status: "error", message: "Too many requests. Please wait before downloading again." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/proxy-video", proxyLimiter, async (req, res) => {
  const parseResult = ProxyVideoQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ status: "error", message: "Missing or invalid video URL." });
  }

  const { url } = parseResult.data;

  let videoUrl: string;
  try {
    videoUrl = decodeURIComponent(url);
    const parsed = new URL(videoUrl);
    const validHosts = [
      "kuaishou.com", "ks3cdn.com", "kspkg.com", "kuaishoupkg.com", "gifshow.com",
      "kwai.com", "kwai.app", "kwai-video.com", "kwaicdn.com", "akwai.com",
      "kwai.net", "ak-br-cdn.kwai.net", "aws-us-cdn.kwai.net", "aws-br-cdn.kwai.net",
      "ak-br-pic.kwai.net", "aws-us-pic.kwai.net", "p1-kimg.kwai.net", "p15-kimg.kwai.net",
      "ak-static.kwai.net", "cdn-static.kwai.net",
    ];
    const isValid = validHosts.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`),
    );
    if (!isValid) {
      return res.status(400).json({ status: "error", message: "Invalid video URL for proxy." });
    }
  } catch {
    return res.status(400).json({ status: "error", message: "Malformed video URL." });
  }

  try {
    const response = await axios.get(videoUrl, {
      responseType: "stream",
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: videoUrl.includes("kwai") ? "https://www.kwai.com/" : "https://www.kuaishou.com/",
        Range: req.headers.range || "bytes=0-",
      },
      maxRedirects: 10,
      validateStatus: (s) => s < 500,
    });

    const contentType = response.headers["content-type"] || "video/mp4";
    const contentLength = response.headers["content-length"];
    const contentRange = response.headers["content-range"];
    const statusCode = response.status;

    res.status(statusCode === 206 ? 206 : 200);
    res.setHeader("Content-Type", contentType);
    const filename = videoUrl.includes("kwai") ? "kwai-video.mp4" : "kuaishou-video.mp4";
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-cache");

    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);

    response.data.pipe(res);

    response.data.on("error", (err: Error) => {
      req.log.error({ err }, "Stream error during video proxy");
      if (!res.headersSent) {
        res.status(500).json({ status: "error", message: "Failed to stream video." });
      }
    });
  } catch (err) {
    req.log.error({ err, videoUrl }, "Failed to proxy video");
    if (!res.headersSent) {
      res.status(500).json({ status: "error", message: "Failed to fetch video for download." });
    }
  }
});

export default router;
