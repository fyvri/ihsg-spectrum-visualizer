/* =============================================================================
   PlayerBar + MusicPicker — transport UI and the 3-tab picker (Library /
   Device / YouTube). Ported 1:1 from project/visualizer.jsx.
   ============================================================================= */
import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent as RPointerEvent,
} from "react";
import { SONGS, parseYouTubeId, fmtTime, type AudioEngine } from "../audio/useAudioEngine";
import type { Strings } from "../i18n";
import {
  IconUpload,
  IconNote,
  IconPlay,
  IconPause,
  IconLoop,
  IconVol,
  IconVolMute,
  IconLibrary,
  IconDevice,
  IconYouTube,
  IconCheckSm,
  IconClose,
} from "./icons";

function MusicPicker({
  open,
  onClose,
  engine,
  T,
}: {
  open: boolean;
  onClose: () => void;
  engine: AudioEngine;
  T: Strings;
}) {
  const [tab, setTab] = useState<"library" | "device" | "youtube">("library");
  const [picked, setPicked] = useState<string | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [deviceFile, setDeviceFile] = useState<File | null>(null);
  const [devicePreview, setDevicePreview] = useState("");
  const [deviceErr, setDeviceErr] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef("");

  useEffect(() => {
    previewRef.current = devicePreview;
  }, [devicePreview]);

  const ytId = parseYouTubeId(ytUrl);
  const ytBad = !!ytUrl.trim() && !ytId;

  useEffect(() => {
    if (!open) return;
    setTab("library");
    setPicked(null);
    setYtUrl("");
    setDeviceErr(false);
    setDragging(false);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    setDeviceFile(null);
    setDevicePreview("");
  }, [open]);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function useLibrary() {
    const song = SONGS.find((s) => s.id === picked);
    if (!song) return;
    engine.loadLibrary(song);
    engine.toggle();
    onClose();
  }

  function acceptFile(f: File | undefined) {
    if (!f) return;
    const isAudio =
      (f.type && f.type.startsWith("audio/")) ||
      /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i.test(f.name);
    if (!isAudio) {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      setDeviceFile(null);
      setDevicePreview("");
      setDeviceErr(true);
      return;
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    setDeviceErr(false);
    setDeviceFile(f);
    setDevicePreview(URL.createObjectURL(f));
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    acceptFile(f || undefined);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    acceptFile(f || undefined);
  }
  function useDevice() {
    if (!deviceFile) return;
    engine.loadFile(deviceFile);
    engine.toggle();
    onClose();
  }

  function useYouTube() {
    if (!ytId) return;
    engine.loadYouTube(ytId, "YouTube · " + ytId);
    onClose();
  }

  const tabs: [typeof tab, string, JSX.Element][] = [
    ["library", T.musicLibrary, <IconLibrary key="l" />],
    ["device", T.musicDevice, <IconDevice key="d" />],
    ["youtube", T.musicYoutube, <IconYouTube key="y" />],
  ];

  return (
    <div className={"music-root" + (open ? " open" : "")} aria-hidden={!open}>
      <div className="music-scrim" onClick={onClose} />
      <div className="music-modal" role="dialog" aria-modal="true" aria-label={T.chooseMusic}>
        <div className="music-head">
          <h2>{T.chooseMusic}</h2>
          <button className="icon-btn ghost sm" aria-label={T.close} onClick={onClose}>
            <IconClose />
          </button>
        </div>

        <div className="music-tabs" role="tablist">
          {tabs.map(([key, label, icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={"music-tab" + (tab === key ? " active" : "")}
              onClick={() => setTab(key)}
            >
              <span className="mt-ico">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        <div className="music-body">
          {tab === "library" && (
            <div className="lib-pane">
              <p className="music-desc">{T.libraryDesc}</p>
              {SONGS.length === 0 ? (
                <p className="music-empty">{T.libraryEmpty}</p>
              ) : (
                <div className="song-list">
                  {SONGS.map((s) => (
                    <button
                      key={s.id}
                      className={"song-row" + (picked === s.id ? " active" : "")}
                      onClick={() => setPicked(s.id)}
                    >
                      <span className="song-ico">
                        <IconNote />
                      </span>
                      <span className="song-meta">
                        <span className="song-title">{s.title}</span>
                        {s.sub && <span className="song-sub">{s.sub}</span>}
                      </span>
                      {picked === s.id && (
                        <span className="song-check">
                          <IconCheckSm />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="music-actions">
                <button className="use-btn" disabled={!picked} onClick={useLibrary}>
                  {T.use}
                </button>
              </div>
            </div>
          )}

          {tab === "device" && (
            <div className="device-pane">
              {!deviceFile ? (
                <div
                  className={"device-drop" + (dragging ? " dragging" : "")}
                  onClick={() => fileRef.current && fileRef.current.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <span className="device-ico">
                    <IconUpload />
                  </span>
                  <p className="device-title">{T.dropHere}</p>
                  <p className="music-desc">{T.orBrowse}</p>
                </div>
              ) : (
                <div className="file-preview">
                  <div className="file-row">
                    <span className="song-ico">
                      <IconNote />
                    </span>
                    <span className="song-meta">
                      <span className="song-title">{deviceFile.name}</span>
                      <span className="song-sub">{T.previewLabel}</span>
                    </span>
                    <button
                      className="icon-btn ghost sm"
                      aria-label={T.close}
                      onClick={() => {
                        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
                        setDeviceFile(null);
                        setDevicePreview("");
                      }}
                    >
                      <IconClose />
                    </button>
                  </div>
                  <audio className="file-audio" src={devicePreview} controls preload="metadata" />
                  <div className="music-actions">
                    <button className="use-btn" onClick={useDevice}>
                      {T.use}
                    </button>
                  </div>
                </div>
              )}
              {deviceErr && <p className="yt-error">{T.notAudio}</p>}
              <input type="file" accept="audio/*" ref={fileRef} onChange={onFile} hidden />
            </div>
          )}

          {tab === "youtube" && (
            <div className="yt-pane">
              <p className="music-desc">{T.ytDesc}</p>
              <label className="yt-field">
                <span className="yt-prefix">
                  <IconYouTube />
                </span>
                <input
                  type="url"
                  inputMode="url"
                  placeholder={T.ytPlaceholder}
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") useYouTube();
                  }}
                />
              </label>
              {ytBad && <p className="yt-error">{T.ytInvalid}</p>}
              {ytId ? (
                <div className="yt-preview">
                  <iframe
                    src={"https://www.youtube-nocookie.com/embed/" + ytId}
                    title="YouTube preview"
                    allow="encrypted-media; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              ) : null}
              <div className="music-actions">
                <button className="use-btn" disabled={!ytId} onClick={useYouTube}>
                  {T.use}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PlayerBar({ engine, T }: { engine: AudioEngine; T: Strings }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { playing, time, duration, volume, loop, fileName, artist, hasTrack, muted } = engine;
  const pct = duration ? (time / duration) * 100 : 0;

  function openPicker() {
    setPickerOpen(true);
  }
  async function onPlay() {
    const ok = await engine.toggle();
    if (ok === false) openPicker();
  }
  function onSeekDown(e: RPointerEvent<HTMLDivElement>) {
    if (!duration) return;
    const track = e.currentTarget;
    try {
      track.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const rect = track.getBoundingClientRect();
    const set = (cx: number) => {
      let r = (cx - rect.left) / rect.width;
      r = Math.min(1, Math.max(0, r));
      engine.seek(r * duration);
    };
    set(e.clientX);
    const move = (ev: PointerEvent) => set(ev.clientX);
    const up = () => {
      track.removeEventListener("pointermove", move);
      track.removeEventListener("pointerup", up);
      track.removeEventListener("pointercancel", up);
    };
    track.addEventListener("pointermove", move);
    track.addEventListener("pointerup", up);
    track.addEventListener("pointercancel", up);
  }

  return (
    <div className="player">
      <div className="player-file">
        <button
          className="icon-btn ghost sm"
          onClick={openPicker}
          aria-label={T.pickMusic}
          title={T.pickMusic}
        >
          <IconUpload />
        </button>
        <button
          className={"track-name as-btn" + (hasTrack ? " on" : "")}
          onClick={openPicker}
          title={T.pickMusic}
        >
          <span className="note">
            <IconNote />
          </span>
          <span className="track-meta">
            <span className="track-title">{fileName || T.noTrack}</span>
            {artist && <span className="track-artist">{artist}</span>}
          </span>
        </button>
      </div>

      <div className="player-controls">
        <button className="play-btn" onClick={onPlay} aria-label={playing ? T.pause : T.play}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <div className="seek-group">
          <span className="time">{fmtTime(time)}</span>
          <div className="seek" onPointerDown={onSeekDown}>
            <div className="seek-fill" style={{ width: pct + "%" }} />
            <div className="seek-knob" style={{ left: pct + "%" }} />
          </div>
          <span className="time end">{fmtTime(duration)}</span>
        </div>
        <div className="tools-group">
          <button
            className={"icon-btn ghost sm" + (loop ? " active" : "")}
            onClick={engine.toggleLoop}
            aria-label={T.loop}
            title={T.loop}
          >
            <IconLoop />
          </button>
          <div className="vol">
            <button
              className={"icon-btn ghost sm" + (muted ? " active" : "")}
              onClick={engine.toggleMute}
              aria-label={muted ? T.unmute : T.mute}
              title={muted ? T.unmute : T.mute}
            >
              {muted ? <IconVolMute /> : <IconVol />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : volume}
              style={{ ["--vol-pct" as string]: (muted ? 0 : volume) * 100 + "%" }}
              onChange={(e) => {
                if (muted) engine.toggleMute();
                engine.setVolume(parseFloat(e.target.value));
              }}
              aria-label={T.volume}
            />
          </div>
        </div>
      </div>

      <MusicPicker open={pickerOpen} onClose={() => setPickerOpen(false)} engine={engine} T={T} />
    </div>
  );
}
