import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useDownloadVideo } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Download, Copy, Play, Zap, AlertCircle, ArrowRight } from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const downloadMutation = useDownloadVideo();
  
  const handleDownload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setError("Please enter a Kuaishou or Kwai video URL");
      return;
    }
    
    // Basic validation — accept both Kuaishou and Kwai
    const isKuaishou = url.includes("kuaishou.com") || url.includes("gifshow.com");
    const isKwai = url.includes("kwai.com") || url.includes("kwai.app");
    if (!isKuaishou && !isKwai) {
      setError("Please enter a valid Kuaishou or Kwai video URL");
      return;
    }
    
    setError(null);
    
    downloadMutation.mutate(
      { data: { url } },
      {
        onError: (err) => {
          // @ts-ignore
          setError(err?.message || "Failed to extract video. Please check the URL and try again.");
          toast.error("Download failed", {
            description: "Could not extract the video from the provided URL.",
          });
        },
        onSuccess: () => {
          toast.success("Video extracted!", {
            description: "Your video is ready to download.",
          });
        }
      }
    );
  };
  
  const handleFileDownload = async (videoUrl: string) => {
    if (isDownloading) return;
    const filename = videoUrl.includes("kwai") ? "kwai-video.mp4" : "kuaishou-video.mp4";
    const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(videoUrl)}`;
    setIsDownloading(true);
    toast.loading("Downloading video…", { id: "dl", description: "Please wait, fetching file." });
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      toast.success("Download complete!", { id: "dl", description: `Saved as ${filename}` });
    } catch (err) {
      toast.error("Download failed", { id: "dl", description: "Could not download the video. Please try again." });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = (videoUrl: string) => {
    navigator.clipboard.writeText(videoUrl);
    toast.success("Link copied!", {
      description: "Direct video link copied to clipboard.",
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark selection:bg-primary/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-[40%] -right-[20%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <header className="w-full p-6 flex justify-between items-center relative z-10 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground shadow-[0_0_15px_rgba(0,240,255,0.4)]">
            <Zap className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">KSD<span className="text-primary">.</span></span>
        </div>
        <div className="hidden md:flex gap-4">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
            API Docs
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
            GitHub
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 max-w-4xl mx-auto w-full">
        <div className="w-full space-y-10">
          <div className="space-y-4 text-center flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            <Badge variant="outline" className="px-3 py-1 border-primary/30 text-primary bg-primary/10 mb-4 backdrop-blur-sm">
              <Zap className="w-3 h-3 mr-1 inline-block" /> v2.0 - Lightning Fast Extraction
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white">
              Extract without<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/50">friction.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
              The fastest, cleanest way to save Kuaishou and Kwai videos. No clutter, no ads, just paste and download in original quality.
            </p>
          </div>

          <Card className="w-full border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-700 delay-150 fill-mode-both">
            <CardContent className="p-2 md:p-4">
              <form onSubmit={handleDownload} className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Input
                    type="url"
                    placeholder="https://v.kuaishou.com/... or https://kwai.com/..."
                    className="w-full h-14 md:h-16 pl-6 pr-4 bg-white/5 border-white/10 text-lg md:text-xl placeholder:text-muted-foreground/50 focus-visible:ring-primary/50 focus-visible:border-primary rounded-xl transition-all"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={downloadMutation.isPending}
                    data-testid="input-url"
                  />
                  {url && !downloadMutation.isPending && (
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                      onClick={() => setUrl("")}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <Button 
                  type="submit" 
                  disabled={downloadMutation.isPending || !url}
                  className="h-14 md:h-16 px-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-lg transition-all shadow-[0_0_20px_rgba(0,240,255,0.2)] hover:shadow-[0_0_30px_rgba(0,240,255,0.4)] group"
                  data-testid="button-extract"
                >
                  {downloadMutation.isPending ? (
                    <>
                      <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                      Extracting
                    </>
                  ) : (
                    <>
                      Extract
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </form>
              
              {error && (
                <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Result Section */}
          {downloadMutation.isSuccess && downloadMutation.data && (
            <div className="mt-12 animate-in fade-in zoom-in-95 duration-500 w-full">
              <Card className="border-white/10 bg-black/40 backdrop-blur-md overflow-hidden group border-l-4 border-l-primary">
                <div className="grid md:grid-cols-5 gap-6 p-6">
                  {/* Video preview / Thumbnail */}
                  <div className="md:col-span-2 relative rounded-lg overflow-hidden bg-black/50 aspect-[9/16] border border-white/5 shadow-inner">
                    {downloadMutation.data.video_url ? (
                      <video 
                        src={`/api/proxy-video?url=${encodeURIComponent(downloadMutation.data.video_url)}`}
                        poster={downloadMutation.data.thumbnail || undefined}
                        controls 
                        className="w-full h-full object-contain"
                        controlsList="nodownload"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                        <Play className="w-12 h-12 mb-4 opacity-20" />
                        <p>Preview unavailable</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Details & Actions */}
                  <div className="md:col-span-3 flex flex-col justify-center space-y-6">
                    <div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0">
                          {downloadMutation.data.quality || "HD"}
                        </Badge>
                        {downloadMutation.data.duration != null && (
                          <Badge variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0">
                            {(() => {
                              const s = Math.round(downloadMutation.data.duration / 1000);
                              const m = Math.floor(s / 60);
                              const sec = s % 60;
                              return `${m}:${String(sec).padStart(2, "0")}`;
                            })()}
                          </Badge>
                        )}
                        {downloadMutation.data.author && (
                          <Badge variant="outline" className="border-white/10 text-muted-foreground">
                            @ {downloadMutation.data.author}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-xl md:text-2xl font-medium text-white line-clamp-3 leading-snug">
                        {downloadMutation.data.title || "Untitled Video"}
                      </h3>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button 
                        size="lg" 
                        className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium h-14"
                        data-testid="button-download"
                        disabled={isDownloading}
                        onClick={() => handleFileDownload(downloadMutation.data.video_url)}
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Downloading…
                          </>
                        ) : (
                          <>
                            <Download className="w-5 h-5 mr-2" />
                            Download File
                          </>
                        )}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="lg" 
                        className="rounded-xl border-white/20 hover:bg-white/10 h-14 px-6"
                        onClick={() => handleCopyLink(downloadMutation.data.video_url)}
                        data-testid="button-copy-link"
                      >
                        <Copy className="w-5 h-5 mr-2" />
                        Copy Link
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-muted-foreground text-sm relative z-10">
        <p>© {new Date().getFullYear()} KSD. This tool is not affiliated with Kuaishou or Kwai.</p>
      </footer>
    </div>
  );
}
