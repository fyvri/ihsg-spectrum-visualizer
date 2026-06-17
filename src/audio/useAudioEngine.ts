/* =============================================================================
   Audio engine — one transport fronting three sources (library / file /
   youtube). File + library run through a Web Audio analyser so the spectrum
   reacts to the real signal; YouTube audio is cross-origin and can't be tapped,
   so during YT playback the spectrum animates synthetically. Ported 1:1 from
   project/visualizer.jsx (useAudioEngine).
   ============================================================================= */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import librarySongs from "virtual:song-library";

export interface Song {
  id: string;
  title: string;
  sub?: string;
  url: string;
}

export type SourceKind = "file" | "library" | "youtube";

export interface AudioEngine {
  analyserRef: MutableRefObject<AnalyserNode | null>;
  playingRef: MutableRefObject<boolean>;
  sourceRef: MutableRefObject<SourceKind>;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  loop: boolean;
  fileName: string;
  artist: string;
  muted: boolean;
  source: SourceKind;
  hasTrack: boolean;
  toggle: () => Promise<boolean>;
  seek: (sec: number) => void;
  loadFile: (file: File) => void;
  loadLibrary: (song: Song, resumeAt?: number) => void;
  loadYouTube: (videoId: string, title?: string) => void;
  setVolume: (v: number) => void;
  toggleLoop: () => void;
  toggleMute: () => void;
}

/* Built-in library tracks. The list is generated at BUILD time from whatever
   audio files are present in public/audio/ — `title`/`sub` come from each MP3's
   ID3 tags (TIT2/TPE1), falling back to the "Artist - Title.mp3" filename. The
   files are bring-your-own / git-ignored (they may be copyrighted), so the
   library reflects whatever you drop in; no code edit needed. Same-origin
   /audio/* URLs so the Web Audio analyser can read them (cross-origin audio
   taints the analyser). See vite-plugin-song-library.ts + public/audio/README.md. */
export const SONGS: Song[] = librarySongs;

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Pull a video id out of any common YouTube URL shape — or a bare 11-char id. */
export function parseYouTubeId(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/[?&]v=([\w-]{11})/))) return m[1];
  if ((m = s.match(/youtu\.be\/([\w-]{11})/))) return m[1];
  if ((m = s.match(/\/(?:shorts|embed|live)\/([\w-]{11})/))) return m[1];
  if ((m = s.match(/([\w-]{11})/))) return m[1];
  return "";
}

function ensureYTApi(cb: () => void) {
  if (window.YT && window.YT.Player) {
    cb();
    return;
  }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (prev) prev();
    cb();
  };
  if (!document.getElementById("yt-iframe-api")) {
    const tag = document.createElement("script");
    tag.id = "yt-iframe-api";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }
}

export function useAudioEngine(): AudioEngine {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== "undefined") audioRef.current = new Audio();
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const playingRef = useRef(false);

  const ytRef = useRef<any>(null);
  const ytPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourceRef = useRef<SourceKind>("file");

  const lsGet = (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const lsSet = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  };
  const lastTimeSaveRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVol] = useState<number>(() => {
    const v = parseFloat(lsGet("ihsg.player.volume") || "");
    return isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8;
  });
  const [muted, setMuted] = useState(() => lsGet("ihsg.player.muted") === "1");
  const [loop, setLoop] = useState(() => lsGet("ihsg.player.loop") === "1");
  const [fileName, setFileName] = useState("");
  const [artist, setArtist] = useState("");
  const [source, setSource] = useState<SourceKind>("file");

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.loop = loop;
    a.muted = muted;
    const onTime = () => {
      if (sourceRef.current === "youtube") return;
      setTime(a.currentTime);
      // Persist a library track's position so a refresh resumes it — but ONLY
      // while genuinely playing. Loading/seeking fire a timeupdate at 0; saving
      // those would clobber the stored spot before applyResume restores it.
      if (sourceRef.current === "library" && !a.paused) {
        const now = Date.now();
        if (now - lastTimeSaveRef.current > 900) {
          lastTimeSaveRef.current = now;
          lsSet("ihsg.player.time", String(a.currentTime));
        }
      }
    };
    const onMeta = () => {
      if (sourceRef.current !== "youtube") setDuration(a.duration || 0);
    };
    const onEnd = () => {
      if (!a.loop && sourceRef.current !== "youtube") {
        setPlaying(false);
        playingRef.current = false;
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    const yt = ytRef.current;
    if (yt && yt.setVolume) yt.setVolume(Math.round((muted ? 0 : volume) * 100));
    lsSet("ihsg.player.volume", String(volume));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
    const yt = ytRef.current;
    if (yt) {
      if (muted && yt.mute) yt.mute();
      else if (yt.unMute) {
        yt.unMute();
        if (yt.setVolume) yt.setVolume(Math.round(volume * 100));
      }
    }
    lsSet("ihsg.player.muted", muted ? "1" : "0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop;
    lsSet("ihsg.player.loop", loop ? "1" : "0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

  function ensureCtx() {
    if (ctxRef.current) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.55;
    const src = ctx.createMediaElementSource(audioRef.current!);
    src.connect(analyser);
    analyser.connect(ctx.destination);
    ctxRef.current = ctx;
    analyserRef.current = analyser;
  }

  function stopYTPoll() {
    if (ytPollRef.current) {
      clearInterval(ytPollRef.current);
      ytPollRef.current = null;
    }
  }
  function startYTPoll() {
    stopYTPoll();
    ytPollRef.current = setInterval(() => {
      const yt = ytRef.current;
      if (!yt || !yt.getCurrentTime) return;
      setTime(yt.getCurrentTime() || 0);
      const d = yt.getDuration ? yt.getDuration() : 0;
      if (d) setDuration(d);
    }, 250);
  }

  function loadAudioSrc(src: string, name: string, kind: SourceKind) {
    const a = audioRef.current!;
    if (ytRef.current && ytRef.current.stopVideo) ytRef.current.stopVideo();
    stopYTPoll();
    if (a.src && a.src.startsWith("blob:")) URL.revokeObjectURL(a.src);
    a.src = src;
    a.load();
    setSource(kind);
    sourceRef.current = kind;
    setFileName(name);
    setArtist("");
    setPlaying(false);
    playingRef.current = false;
    setTime(0);
    setDuration(0);
  }

  const loadFile = useCallback((file: File) => {
    if (!file) return;
    try {
      localStorage.removeItem("ihsg.lib.song");
    } catch {
      /* ignore */
    }
    loadAudioSrc(URL.createObjectURL(file), file.name, "file");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyResume(sec: number) {
    const a = audioRef.current;
    if (!a) return;
    const go = () => {
      const d = a.duration;
      const t = isFinite(d) && d > 0 ? Math.min(sec, d - 0.25) : sec;
      try {
        a.currentTime = Math.max(0, t);
      } catch {
        /* ignore */
      }
      setTime(a.currentTime);
      a.removeEventListener("loadedmetadata", go);
    };
    if (a.readyState >= 1 && isFinite(a.duration) && a.duration > 0) go();
    else a.addEventListener("loadedmetadata", go);
  }

  const loadLibrary = useCallback((song: Song, resumeAt?: number) => {
    if (!song) return;
    try {
      localStorage.setItem("ihsg.lib.song", song.id);
    } catch {
      /* ignore */
    }
    const resume =
      isFinite(resumeAt as number) && (resumeAt as number) > 0 ? (resumeAt as number) : 0;
    if (!resume) {
      lsSet("ihsg.player.time", "0");
      lastTimeSaveRef.current = 0;
    }
    setSource("library");
    sourceRef.current = "library";
    setFileName(song.title);
    setArtist(song.sub || "");
    setPlaying(false);
    playingRef.current = false;
    setTime(0);
    setDuration(0);
    fetch(song.url)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.blob();
      })
      .then((blob) => {
        loadAudioSrc(URL.createObjectURL(blob), song.title, "library");
        setArtist(song.sub || "");
        if (resume) applyResume(resume);
      })
      .catch(() => {
        loadAudioSrc(song.url, song.title, "library");
        setArtist(song.sub || "");
        if (resume) applyResume(resume);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadYouTube = useCallback(
    (videoId: string, title?: string) => {
      if (!videoId) return;
      try {
        localStorage.removeItem("ihsg.lib.song");
      } catch {
        /* ignore */
      }
      audioRef.current && audioRef.current.pause();
      setSource("youtube");
      sourceRef.current = "youtube";
      setFileName(title || "YouTube");
      setArtist("");
      setPlaying(false);
      playingRef.current = false;
      setTime(0);
      setDuration(0);

      // Pull the real video title/author from the IFrame API once available
      // and show it as the track name (the videoId placeholder is replaced).
      const applyYTMeta = () => {
        const yt = ytRef.current;
        const vd = yt && yt.getVideoData ? yt.getVideoData() : null;
        if (vd && vd.title) {
          setFileName(vd.title);
          if (vd.author) setArtist(vd.author);
        }
      };

      ensureYTApi(() => {
        const onState = (e: any) => {
          const YT = window.YT;
          if (e.data === YT.PlayerState.PLAYING) {
            setPlaying(true);
            playingRef.current = true;
            applyYTMeta();
            startYTPoll();
            const d = ytRef.current.getDuration ? ytRef.current.getDuration() : 0;
            if (d) setDuration(d);
          } else if (e.data === YT.PlayerState.PAUSED) {
            setPlaying(false);
            playingRef.current = false;
            stopYTPoll();
          } else if (e.data === YT.PlayerState.ENDED) {
            stopYTPoll();
            if (loop && ytRef.current) {
              ytRef.current.seekTo(0, true);
              ytRef.current.playVideo();
            } else {
              setPlaying(false);
              playingRef.current = false;
              setTime(0);
            }
          }
        };
        const onReady = () => {
          const yt = ytRef.current;
          if (yt.setVolume) yt.setVolume(Math.round((muted ? 0 : volume) * 100));
          if (muted && yt.mute) yt.mute();
          applyYTMeta();
          yt.playVideo && yt.playVideo();
        };
        if (ytRef.current && ytRef.current.loadVideoById) {
          ytRef.current.loadVideoById(videoId);
          ytRef.current.playVideo && ytRef.current.playVideo();
        } else {
          let host = document.getElementById("yt-audio-host");
          if (!host) {
            host = document.createElement("div");
            host.id = "yt-audio-host";
            host.style.cssText =
              "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
            document.body.appendChild(host);
          }
          ytRef.current = new window.YT.Player(host, {
            videoId,
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              modestbranding: 1,
              playsinline: 1,
              rel: 0,
            },
            events: { onReady, onStateChange: onState },
          });
        }
      });
    },
    [volume, muted, loop]
  );

  const toggle = useCallback(async (): Promise<boolean> => {
    if (sourceRef.current === "youtube") {
      const yt = ytRef.current;
      if (!yt || !yt.getPlayerState) return true;
      if (playingRef.current) yt.pauseVideo();
      else yt.playVideo();
      return true;
    }
    const a = audioRef.current;
    if (!a || !a.src) return false; // no track -> caller opens picker
    ensureCtx();
    if (ctxRef.current && ctxRef.current.state === "suspended") await ctxRef.current.resume();
    if (a.paused) {
      try {
        await a.play();
        setPlaying(true);
        playingRef.current = true;
      } catch {
        /* autoplay rejection */
      }
    } else {
      a.pause();
      setPlaying(false);
      playingRef.current = false;
      if (sourceRef.current === "library") {
        lastTimeSaveRef.current = Date.now();
        lsSet("ihsg.player.time", String(a.currentTime));
      }
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seek = useCallback((sec: number) => {
    if (!isFinite(sec)) return;
    if (sourceRef.current === "youtube") {
      const yt = ytRef.current;
      if (yt && yt.seekTo) {
        yt.seekTo(Math.max(0, sec), true);
        setTime(sec);
      }
      return;
    }
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(sec, a.duration || 0));
    setTime(a.currentTime);
    if (sourceRef.current === "library") {
      lastTimeSaveRef.current = Date.now();
      lsSet("ihsg.player.time", String(a.currentTime));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopYTPoll(), []);

  // Restore the last library track on load — applied (shown), but NOT auto-played.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("ihsg.lib.song");
    } catch {
      /* ignore */
    }
    if (!saved) return;
    const song = SONGS.find((s) => s.id === saved);
    if (!song) return;
    const resumeAt = parseFloat(lsGet("ihsg.player.time") || "");
    loadLibrary(song, isFinite(resumeAt) ? resumeAt : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    analyserRef,
    playingRef,
    sourceRef,
    playing,
    time,
    duration,
    volume,
    loop,
    fileName,
    artist,
    muted,
    source,
    hasTrack: !!fileName,
    toggle,
    seek,
    loadFile,
    loadLibrary,
    loadYouTube,
    setVolume: setVol,
    toggleLoop: () => setLoop((l) => !l),
    toggleMute: () => setMuted((m) => !m),
  };
}

export function fmtTime(s: number): string {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ":" + String(sec).padStart(2, "0");
}
