import axios from "axios";
import * as cheerio from "cheerio";

interface VideoInfo {
  title: string | null;
  thumbnail: string | null;
  video_url: string;
  quality: string;
  author: string | null;
  duration: number | null;
}

const MOBILE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Cache-Control": "max-age=0",
};

const DESKTOP_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.kuaishou.com/",
  "Sec-Ch-Ua":
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Upgrade-Insecure-Requests": "1",
};

const KUAISHOU_DOMAINS = [
  "kuaishou.com",
  "www.kuaishou.com",
  "v.kuaishou.com",
  "m.kuaishou.com",
  "gifshow.com",
  "www.gifshow.com",
];

const KWAI_DOMAINS = [
  "kwai.com",
  "www.kwai.com",
  "v.kwai.com",
  "m.kwai.com",
  "kwai.app",
  "www.kwai.app",
  "kwai-video.com",
  "share.kwai.app",
];

export function isKwaiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return KWAI_DOMAINS.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export function isKuaishouUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return KUAISHOU_DOMAINS.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export function isValidUrl(url: string): boolean {
  return isKuaishouUrl(url) || isKwaiUrl(url);
}

function normalizeUrl(url: string): string {
  url = url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

function extractVideoFromJson(jsonStr: string): VideoInfo | null {
  try {
    const data = JSON.parse(jsonStr);

    const tryPaths = [
      data?.defaultClient?.["VisionVideoDetailPhoto:1"]?.photoH265Url,
      data?.defaultClient?.["VisionVideoDetailPhoto:1"]?.photoUrl,
      data?.defaultClient?.["VisionVideoDetailPhoto:1"]?.mainMvUrls?.[0]?.url,
    ];

    const photoKeys = Object.keys(data?.defaultClient || {}).filter(
      (k) =>
        k.startsWith("VisionVideoDetailPhoto:") ||
        k.startsWith("VisionPhoto:") ||
        k.startsWith("Photo:"),
    );

    let videoUrl: string | null = null;
    let title: string | null = null;
    let thumbnail: string | null = null;
    let author: string | null = null;
    let duration: number | null = null;

    for (const p of tryPaths) {
      if (p && typeof p === "string" && p.startsWith("http")) {
        videoUrl = p;
        break;
      }
    }

    for (const key of photoKeys) {
      const photo = data.defaultClient[key];
      if (!photo) continue;

      if (!videoUrl) {
        const urlCandidates = [
          photo.photoH265Url,
          photo.photoUrl,
          photo.mainMvUrls?.[0]?.url,
          photo.mp4Url,
        ];
        for (const u of urlCandidates) {
          if (u && typeof u === "string" && u.startsWith("http")) {
            videoUrl = u;
            break;
          }
        }
      }

      if (!title && photo.caption) {
        title = photo.caption;
      }

      if (!thumbnail) {
        thumbnail =
          photo.coverUrl || photo.webpCoverUrl || photo.thumbnail || null;
      }

      if (!duration && photo.duration) {
        duration = photo.duration;
      }

      if (!author) {
        const authorRef = photo.author?.__ref;
        if (authorRef) {
          const authorData = data.defaultClient[authorRef];
          author = authorData?.name || null;
        }
      }
    }

    if (videoUrl) {
      return { title, thumbnail, video_url: videoUrl, quality: "HD", author, duration };
    }
  } catch {
  }
  return null;
}

function deepFindVideoUrl(obj: unknown, depth = 0): string | null {
  if (depth > 10) return null;
  if (typeof obj === "string" && (obj.includes(".mp4") || obj.includes("video")) && obj.startsWith("http")) return obj;
  if (typeof obj !== "object" || obj === null) return null;
  for (const val of Object.values(obj)) {
    const found = deepFindVideoUrl(val, depth + 1);
    if (found) return found;
  }
  return null;
}

function parseScriptsForVideo(html: string, $: cheerio.CheerioAPI): VideoInfo | null {
  const scripts = $("script").toArray();
  for (const script of scripts) {
    const content = $(script).html() || "";

    if (content.includes("__APOLLO_STATE__")) {
      const patterns = [
        /window\.__APOLLO_STATE__\s*=\s*(\{.+?\});?\s*(?:window\.|$)/s,
        /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]+\})/,
      ];
      for (const pat of patterns) {
        const match = content.match(pat);
        if (match) {
          const result = extractVideoFromJson(match[1]);
          if (result) return result;
        }
      }
    }

    if (content.includes('"photoUrl"') || content.includes('"mp4Url"') || content.includes('"videoUrl"') || content.includes('"playUrls"')) {
      const jsonMatches = content.match(/\{[^{}]*(?:"photoUrl"|"mp4Url"|"videoUrl"|"playUrls")[^{}]*\}/g);
      if (jsonMatches) {
        for (const jsonStr of jsonMatches) {
          try {
            const obj = JSON.parse(jsonStr);
            const videoUrl = obj.photoUrl || obj.mp4Url || obj.videoUrl || obj.photoH265Url;
            if (videoUrl && typeof videoUrl === "string" && videoUrl.startsWith("http")) {
              return {
                title: obj.caption || obj.title || null,
                thumbnail: obj.coverUrl || obj.thumbnail || null,
                video_url: videoUrl,
                quality: "HD",
                author: null,
                duration: obj.duration || null,
              };
            }
          } catch {
            continue;
          }
        }
      }
    }

    if (content.includes("window.__INITIAL_STATE__")) {
      const match = content.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\})\s*;/);
      if (match) {
        try {
          const state = JSON.parse(match[1]);
          const videoUrl = deepFindVideoUrl(state);
          if (videoUrl) {
            return {
              title: null,
              thumbnail: null,
              video_url: videoUrl,
              quality: "HD",
              author: null,
              duration: null,
            };
          }
        } catch {
        }
      }
    }
  }
  return null;
}

async function scrapeKuaishouUrl(url: string): Promise<VideoInfo> {
  const mobileResponse = await axios.get(url, {
    headers: MOBILE_HEADERS,
    maxRedirects: 10,
    timeout: 12000,
    validateStatus: (s) => s < 500,
  });

  const html = mobileResponse.data as string;
  const $ = cheerio.load(html);

  const ogVideoUrl =
    $('meta[property="og:video"]').attr("content") ||
    $('meta[property="og:video:url"]').attr("content") ||
    $('meta[name="twitter:player:stream"]').attr("content");

  if (ogVideoUrl && ogVideoUrl.startsWith("http")) {
    return {
      title: $('meta[property="og:title"]').attr("content") || $("title").text() || null,
      thumbnail: $('meta[property="og:image"]').attr("content") || $('meta[name="twitter:image"]').attr("content") || null,
      video_url: ogVideoUrl,
      quality: "HD",
      author: null,
      duration: null,
    };
  }

  const scriptResult = parseScriptsForVideo(html, $);
  if (scriptResult) return scriptResult;

  const desktopUrl = url.replace("m.kuaishou.com", "www.kuaishou.com");
  const desktopResponse = await axios.get(desktopUrl, {
    headers: { ...DESKTOP_HEADERS, Referer: "https://www.kuaishou.com/" },
    maxRedirects: 10,
    timeout: 10000,
    validateStatus: (s) => s < 500,
  });

  const html2 = desktopResponse.data as string;
  const $2 = cheerio.load(html2);

  const ogVideo2 =
    $2('meta[property="og:video"]').attr("content") ||
    $2('meta[property="og:video:url"]').attr("content");

  if (ogVideo2 && ogVideo2.startsWith("http")) {
    return {
      title: $2('meta[property="og:title"]').attr("content") || null,
      thumbnail: $2('meta[property="og:image"]').attr("content") || null,
      video_url: ogVideo2,
      quality: "HD",
      author: null,
      duration: null,
    };
  }

  const scriptResult2 = parseScriptsForVideo(html2, $2);
  if (scriptResult2) return scriptResult2;

  throw new Error("Video not found. The video may be private, deleted, or the URL format is not supported.");
}

async function scrapeKwaiUrl(url: string): Promise<VideoInfo> {
  const normalizedUrl = url
    .replace("share.kwai.app", "www.kwai.com")
    .replace("v.kwai.com", "www.kwai.com")
    .replace("m.kwai.com", "www.kwai.com");

  const mobileResponse = await axios.get(normalizedUrl, {
    headers: {
      ...MOBILE_HEADERS,
      "Accept-Language": "en-US,en;q=0.9",
    },
    maxRedirects: 10,
    timeout: 12000,
    validateStatus: (s) => s < 500,
  });

  const html = mobileResponse.data as string;
  const $ = cheerio.load(html);

  const ogVideoUrl =
    $('meta[property="og:video"]').attr("content") ||
    $('meta[property="og:video:url"]').attr("content") ||
    $('meta[property="og:video:secure_url"]').attr("content") ||
    $('meta[name="twitter:player:stream"]').attr("content");

  if (ogVideoUrl && ogVideoUrl.startsWith("http")) {
    return {
      title: $('meta[property="og:title"]').attr("content") || $("title").text() || null,
      thumbnail: $('meta[property="og:image"]').attr("content") || $('meta[name="twitter:image"]').attr("content") || null,
      video_url: ogVideoUrl,
      quality: "HD",
      author: $('meta[property="og:site_name"]').attr("content") || null,
      duration: null,
    };
  }

  const scripts = $("script").toArray();
  for (const script of scripts) {
    const content = $(script).html() || "";

    if (content.includes("playUrls") || content.includes("srcNoMark") || content.includes("videoUrl")) {
      const jsonBlocks = content.match(/\{[\s\S]{20,5000}\}/g) || [];
      for (const block of jsonBlocks) {
        try {
          const obj = JSON.parse(block);
          const candidate =
            obj.playUrls?.[0] ||
            obj.srcNoMark ||
            obj.videoUrl ||
            obj.mp4Url ||
            obj.url;
          if (candidate && typeof candidate === "string" && candidate.startsWith("http") && (candidate.includes("mp4") || candidate.includes("video"))) {
            return {
              title: obj.caption || obj.title || obj.desc || null,
              thumbnail: obj.coverUrl || obj.thumbnail || obj.cover || null,
              video_url: candidate,
              quality: "HD",
              author: obj.authorName || obj.userName || null,
              duration: obj.duration || null,
            };
          }
        } catch {
          continue;
        }
      }
    }

    if (content.includes("__NEXT_DATA__") || content.includes("window.__data")) {
      const match = content.match(/(?:window\.__data|__NEXT_DATA__)\s*=\s*(\{[\s\S]+?\})\s*;?\s*(?:<\/script>|window\.|$)/);
      if (match) {
        try {
          const state = JSON.parse(match[1]);
          const videoUrl = deepFindVideoUrl(state);
          if (videoUrl) {
            return {
              title: null,
              thumbnail: null,
              video_url: videoUrl,
              quality: "HD",
              author: null,
              duration: null,
            };
          }
        } catch {
        }
      }
    }
  }

  const desktopResponse = await axios.get(normalizedUrl, {
    headers: {
      ...DESKTOP_HEADERS,
      Referer: "https://www.kwai.com/",
      "Accept-Language": "en-US,en;q=0.9",
    },
    maxRedirects: 10,
    timeout: 10000,
    validateStatus: (s) => s < 500,
  });

  const html2 = desktopResponse.data as string;
  const $2 = cheerio.load(html2);

  const ogVideo2 =
    $2('meta[property="og:video"]').attr("content") ||
    $2('meta[property="og:video:url"]').attr("content") ||
    $2('meta[property="og:video:secure_url"]').attr("content");

  if (ogVideo2 && ogVideo2.startsWith("http")) {
    return {
      title: $2('meta[property="og:title"]').attr("content") || null,
      thumbnail: $2('meta[property="og:image"]').attr("content") || null,
      video_url: ogVideo2,
      quality: "HD",
      author: null,
      duration: null,
    };
  }

  const scriptResult2 = parseScriptsForVideo(html2, $2);
  if (scriptResult2) return scriptResult2;

  throw new Error("Video not found. The video may be private, deleted, or the URL format is not supported.");
}

const cache = new Map<string, { data: VideoInfo; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function extractVideo(rawUrl: string): Promise<VideoInfo & { cached?: boolean }> {
  if (!rawUrl) {
    throw new Error("URL is required");
  }

  const url = normalizeUrl(rawUrl);

  if (!isValidUrl(url)) {
    throw new Error("Invalid URL. Only Kuaishou and Kwai video URLs are supported (kuaishou.com, v.kuaishou.com, kwai.com, kwai.app)");
  }

  const cached = cache.get(url);
  if (cached && Date.now() < cached.expiresAt) {
    return { ...cached.data, cached: true };
  }

  const info = isKwaiUrl(url)
    ? await scrapeKwaiUrl(url)
    : await scrapeKuaishouUrl(url);

  cache.set(url, { data: info, expiresAt: Date.now() + CACHE_TTL });

  if (cache.size > 100) {
    const now = Date.now();
    for (const [key, val] of cache.entries()) {
      if (val.expiresAt < now) cache.delete(key);
    }
  }

  return { ...info, cached: false };
}
