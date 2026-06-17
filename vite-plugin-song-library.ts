/* =============================================================================
   Vite plugin — `virtual:song-library`

   Builds the Library track list at BUILD/DEV time by scanning public/audio/ and
   reading each MP3's tags (ID3v2 TIT2 = title, TPE1 = artist), falling back to
   the "Artist - Title.mp3" filename convention. The audio files are
   bring-your-own and git-ignored, so the list is *derived from whatever is
   present* rather than hardcoded — drop files in, no code edit needed.

   Consumed by src/audio/useAudioEngine.ts as `SONGS`. Zero runtime dependency:
   a minimal hand-rolled ID3 reader (ID3v2.2/2.3/2.4 text frames + ID3v1
   fallback). Exotic/unsynchronised tags simply fall through to the filename.
   Runs in Node at build/dev time only — nothing here ships to the client.
   ============================================================================= */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:song-library";
const RESOLVED_ID = "\0" + VIRTUAL_ID;
const AUDIO_EXTS = new Set([".mp3", ".m4a", ".ogg", ".wav"]);
const NUL = String.fromCharCode(0); // ID3 text fields are NUL-terminated/separated

interface Song {
  id: string;
  title: string;
  sub?: string;
  url: string;
}

/* ----------------------------- ID3 reading ------------------------------- */

/** Read a 4-byte synchsafe integer (7 usable bits per byte) at `off`. */
function synchsafe(b: Buffer, off: number): number {
  return ((b[off] & 0x7f) << 21) | ((b[off + 1] & 0x7f) << 14) | ((b[off + 2] & 0x7f) << 7) | (b[off + 3] & 0x7f);
}

/** Byte-swap a buffer into UTF-16LE order (drops a trailing odd byte). */
function swap16(b: Buffer): Buffer {
  const even = b.length % 2 === 0 ? b : b.subarray(0, b.length - 1);
  const out = Buffer.from(even);
  out.swap16();
  return out;
}

/** Decode an ID3v2 text frame body (leading byte = encoding). */
function decodeText(data: Buffer): string {
  if (!data.length) return "";
  const enc = data[0];
  const body = data.subarray(1);
  let s: string;
  if (enc === 3) {
    s = body.toString("utf8"); // UTF-8 (v2.4)
  } else if (enc === 1) {
    // UTF-16 with BOM
    if (body[0] === 0xfe && body[1] === 0xff) s = swap16(body.subarray(2)).toString("utf16le");
    else s = (body[0] === 0xff && body[1] === 0xfe ? body.subarray(2) : body).toString("utf16le");
  } else if (enc === 2) {
    s = swap16(body).toString("utf16le"); // UTF-16BE, no BOM (v2.4)
  } else {
    s = body.toString("latin1"); // ISO-8859-1
  }
  // frames may hold NUL-separated values — take the first, strip NULs
  return s.split(NUL)[0].trim();
}

function readId3v2(buf: Buffer): { title?: string; artist?: string } {
  if (buf.length < 10 || buf.toString("latin1", 0, 3) !== "ID3") return {};
  const major = buf[3];
  const flags = buf[5];
  const end = Math.min(buf.length, 10 + synchsafe(buf, 6));
  let pos = 10;
  // skip an extended header if present
  if (flags & 0x40) pos += major === 4 ? synchsafe(buf, pos) : buf.readUInt32BE(pos) + 4;

  const out: { title?: string; artist?: string } = {};
  if (major === 2) {
    // v2.2: 3-char id, 3-byte size, 6-byte frame header
    while (pos + 6 <= end && buf[pos] !== 0) {
      const id = buf.toString("latin1", pos, pos + 3);
      const size = (buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5];
      const start = pos + 6;
      if (size <= 0 || start + size > end) break;
      const data = buf.subarray(start, start + size);
      if (id === "TT2") out.title = decodeText(data);
      else if (id === "TP1") out.artist = decodeText(data);
      pos = start + size;
      if (out.title && out.artist) break;
    }
  } else {
    // v2.3 / v2.4: 4-char id, 4-byte size, 2-byte flags, 10-byte frame header
    while (pos + 10 <= end && buf[pos] !== 0) {
      const id = buf.toString("latin1", pos, pos + 4);
      const size = major === 4 ? synchsafe(buf, pos + 4) : buf.readUInt32BE(pos + 4);
      const start = pos + 10;
      if (size <= 0 || start + size > end) break;
      const data = buf.subarray(start, start + size);
      if (id === "TIT2") out.title = decodeText(data);
      else if (id === "TPE1") out.artist = decodeText(data);
      pos = start + size;
      if (out.title && out.artist) break;
    }
  }
  return out;
}

function readId3v1(buf: Buffer): { title?: string; artist?: string } {
  if (buf.length < 128) return {};
  const tag = buf.subarray(buf.length - 128);
  if (tag.toString("latin1", 0, 3) !== "TAG") return {};
  const clean = (b: Buffer) => b.toString("latin1").split(NUL)[0].trim();
  return {
    title: clean(tag.subarray(3, 33)) || undefined,
    artist: clean(tag.subarray(33, 63)) || undefined,
  };
}

/* --------------------------- filename + slug ----------------------------- */

/** Parse "Artist - Title.ext" → { sub, title }; no " - " → title is the name. */
function fromFilename(file: string): { title: string; sub?: string } {
  const base = file.replace(/\.[^.]+$/, "");
  const i = base.indexOf(" - ");
  if (i > 0) return { sub: base.slice(0, i).trim(), title: base.slice(i + 3).trim() };
  return { title: base.trim() };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "track"
  );
}

/* ------------------------------ build list ------------------------------- */

function buildSongs(audioDir: string): Song[] {
  if (!existsSync(audioDir)) return [];
  const files = readdirSync(audioDir)
    .filter((f) => AUDIO_EXTS.has(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  const seen = new Set<string>();
  const songs: Song[] = [];
  for (const file of files) {
    const fn = fromFilename(file);
    let tag: { title?: string; artist?: string } = {};
    if (extname(file).toLowerCase() === ".mp3") {
      try {
        const buf = readFileSync(join(audioDir, file));
        tag = readId3v2(buf);
        if (!tag.title || !tag.artist) {
          const v1 = readId3v1(buf);
          tag = { title: tag.title || v1.title, artist: tag.artist || v1.artist };
        }
      } catch {
        /* unreadable → filename fallback */
      }
    }
    const title = tag.title?.trim() || fn.title;
    const sub = tag.artist?.trim() || fn.sub;
    let id = slugify(basename(file, extname(file)));
    while (seen.has(id)) id += "-x"; // keep ids unique across like-named files
    seen.add(id);
    songs.push({ id, title, ...(sub ? { sub } : {}), url: "/audio/" + encodeURIComponent(file) });
  }
  return songs;
}

/* ------------------------------- plugin ---------------------------------- */

export default function songLibrary(): Plugin {
  let audioDir = "";
  return {
    name: "song-library",
    configResolved(config) {
      audioDir = join(config.publicDir || join(config.root, "public"), "audio");
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      // re-scanned on every load so dev picks up tag edits without a restart
      if (id === RESOLVED_ID) return `export default ${JSON.stringify(buildSongs(audioDir))};`;
    },
    configureServer(server) {
      const dir = audioDir || join(server.config.root, "public", "audio");
      server.watcher.add(dir);
      const refresh = (file: string) => {
        if (!file.startsWith(dir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" }); // added/removed/retagged a track
      };
      server.watcher.on("add", refresh);
      server.watcher.on("unlink", refresh);
      server.watcher.on("change", refresh);
    },
  };
}
