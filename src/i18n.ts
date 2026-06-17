/* =============================================================================
   i18n — UI string dictionary for the IHSG view (Indonesian / English).
   Ported 1:1 from project/i18n.js. I18N[lang] -> flat map of label keys.
   ============================================================================= */
import type { RangeKey } from "../shared/types";

export type Lang = "id" | "en";

export interface Strings {
  locale: string;
  mon: string[];
  wday: string[];
  timeSep: string;
  name: string;
  disclaimer: string;
  moreAbout: string;
  open: string;
  high: string;
  low: string;
  prevClose: string;
  week52High: string;
  week52Low: string;
  prevCloseFull: string;
  week52HighFull: string;
  week52LowFull: string;
  settings: string;
  language: string;
  appearance: string;
  spectrum: string;
  dark: string;
  light: string;
  share: string;
  copyLink: string;
  copied: string;
  saveImage: string;
  savingImage: string;
  savedImage: string;
  shareImage: string;
  shareInstagram: string;
  preparingImage: string;
  igStoryTitle: string;
  igStoryBody: string;
  igOpen: string;
  shareTwitter: string;
  shareFacebook: string;
  sourceLabel: string;
  close: string;
  songCard: string;
  profileCard: string;
  nowPlaying: string;
  notPlaying: string;
  noTrack: string;
  upload: string;
  pickMusic: string;
  chooseMusic: string;
  musicLibrary: string;
  musicDevice: string;
  musicYoutube: string;
  use: string;
  libraryDesc: string;
  libraryEmpty: string;
  deviceTitle: string;
  deviceDesc: string;
  chooseFile: string;
  ytTitle: string;
  ytDesc: string;
  ytPlaceholder: string;
  ytInvalid: string;
  dropHere: string;
  orBrowse: string;
  notAudio: string;
  previewLabel: string;
  play: string;
  pause: string;
  loop: string;
  volume: string;
  mute: string;
  unmute: string;
  moreDetail: string;
  lunchBreak: string;
  aboutTitle: string;
  aboutText: string;
  wikipedia: string;
  newsTitle: string;
  newsSubtitle: string;
  showMore: string;
  showFewer: string;
  minAgo: string;
  hourAgo: string;
  dayAgo: string;
  tabs: Record<RangeKey, string>;
  ranges: Record<RangeKey, string>;
}

export const I18N: Record<Lang, Strings> = {
  id: {
    locale: "id-ID",
    mon: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
    wday: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
    timeSep: ".",
    name: "Indeks Harga Saham Gabungan",
    disclaimer: "Penafian",
    moreAbout: "Selengkapnya tentang",
    open: "Buka",
    high: "Tinggi",
    low: "Rendah",
    prevClose: "Tutup sblmnya",
    week52High: "Tggi 52 mg",
    week52Low: "Rndh 52 mg",
    prevCloseFull: "Penutupan sebelumnya",
    week52HighFull: "Tertinggi 52 minggu",
    week52LowFull: "Terendah 52 minggu",
    settings: "Pengaturan",
    language: "Bahasa",
    appearance: "Tampilan",
    spectrum: "Model spektrum",
    dark: "Gelap",
    light: "Terang",
    share: "Bagikan",
    copyLink: "Salin tautan",
    copied: "Tersalin!",
    saveImage: "Simpan Gambar",
    savingImage: "Menyimpan…",
    savedImage: "Tersimpan!",
    shareImage: "Bagikan Gambar",
    shareInstagram: "Bagikan ke Story Instagram",
    preparingImage: "Menyiapkan…",
    igStoryTitle: "Bagikan ke Story Instagram",
    igStoryBody:
      "Gambar sudah disimpan ke perangkatmu. Buka Instagram, lalu tambahkan ke Story-mu.",
    igOpen: "Buka Instagram",
    shareTwitter: "Bagikan ke X",
    shareFacebook: "Bagikan ke Facebook",
    sourceLabel: "Sumber",
    close: "Tutup",
    songCard: "Lagu",
    profileCard: "Profil",
    nowPlaying: "Sedang diputar",
    notPlaying: "Tidak ada lagu diputar",
    noTrack: "Belum ada lagu — pilih musik",
    upload: "Unggah audio",
    pickMusic: "Pilih lagu",
    chooseMusic: "Pilih Musik",
    musicLibrary: "Daftar",
    musicDevice: "Perangkat",
    musicYoutube: "YouTube",
    use: "Gunakan",
    libraryDesc: "Pilih salah satu lagu yang tersedia.",
    libraryEmpty: "Belum ada lagu di daftar.",
    deviceTitle: "Ambil dari perangkat",
    deviceDesc:
      "Pilih berkas audio dari perangkat Anda — lagu langsung diterapkan setelah dipilih.",
    chooseFile: "Pilih Berkas",
    ytTitle: "Ambil dari YouTube",
    ytDesc: "Tempel tautan video YouTube, lalu tekan Gunakan.",
    ytPlaceholder: "https://www.youtube.com/watch?v=…",
    ytInvalid: "Tautan YouTube tidak valid",
    dropHere: "Seret & lepas berkas musik ke sini",
    orBrowse: "atau klik untuk memilih",
    notAudio: "Berkas itu bukan audio. Coba berkas lain.",
    previewLabel: "Pratinjau",
    play: "Putar",
    pause: "Jeda",
    loop: "Ulang",
    volume: "Volume",
    mute: "Bisukan",
    unmute: "Suarakan",
    moreDetail: "Lihat detail selengkapnya",
    lunchBreak: "Makan siang",
    aboutTitle: "Tentang",
    aboutText:
      "Indeks Harga Saham Gabungan (IHSG) adalah indeks saham dari seluruh saham yang tercatat di Bursa Efek Indonesia (IDX).",
    wikipedia: "Wikipedia",
    newsTitle: "Berita",
    newsSubtitle: "Dari berbagai sumber di web",
    showMore: "Tampilkan lainnya",
    showFewer: "Tampilkan lebih sedikit",
    minAgo: "menit lalu",
    hourAgo: "jam lalu",
    dayAgo: "hari lalu",
    tabs: {
      "1D": "1HR",
      "5D": "5HR",
      "1M": "1BLN",
      "6M": "6BLN",
      YTD: "YTD",
      "1Y": "1TH",
      "5Y": "5TH",
      Max: "Maks",
    },
    ranges: {
      "1D": "hari ini",
      "5D": "5 hari terakhir",
      "1M": "sebulan terakhir",
      "6M": "6 bulan terakhir",
      YTD: "tahun berjalan",
      "1Y": "setahun terakhir",
      "5Y": "5 tahun terakhir",
      Max: "sepanjang masa",
    },
  },
  en: {
    locale: "en-US",
    mon: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    wday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    timeSep: ":",
    name: "IDX Composite",
    disclaimer: "Disclaimer",
    moreAbout: "More about",
    open: "Open",
    high: "High",
    low: "Low",
    prevClose: "Prev close",
    week52High: "52-wk high",
    week52Low: "52-wk low",
    prevCloseFull: "Previous close",
    week52HighFull: "52-week high",
    week52LowFull: "52-week low",
    settings: "Settings",
    language: "Language",
    appearance: "Appearance",
    spectrum: "Spectrum model",
    dark: "Dark",
    light: "Light",
    share: "Share",
    copyLink: "Copy link",
    copied: "Copied!",
    saveImage: "Save Image",
    savingImage: "Saving…",
    savedImage: "Saved!",
    shareImage: "Share Image",
    shareInstagram: "Share to Instagram Story",
    preparingImage: "Preparing…",
    igStoryTitle: "Share to Instagram Story",
    igStoryBody:
      "The image is saved to your device. Open Instagram and add it to your Story.",
    igOpen: "Open Instagram",
    shareTwitter: "Share on X",
    shareFacebook: "Share on Facebook",
    sourceLabel: "Source",
    close: "Close",
    songCard: "Song",
    profileCard: "Profile",
    nowPlaying: "Now playing",
    notPlaying: "No song playing",
    noTrack: "No track — choose music",
    upload: "Upload audio",
    pickMusic: "Choose music",
    chooseMusic: "Choose music",
    musicLibrary: "Library",
    musicDevice: "Device",
    musicYoutube: "YouTube",
    use: "Use",
    libraryDesc: "Pick one of the available tracks.",
    libraryEmpty: "No tracks in the library yet.",
    deviceTitle: "From your device",
    deviceDesc: "Pick an audio file from your device — it's applied as soon as you choose it.",
    chooseFile: "Choose file",
    ytTitle: "From YouTube",
    ytDesc: "Paste a YouTube video link, then press Use.",
    ytPlaceholder: "https://www.youtube.com/watch?v=…",
    ytInvalid: "Invalid YouTube link",
    dropHere: "Drag & drop a music file here",
    orBrowse: "or click to browse",
    notAudio: "That file isn't audio. Try another file.",
    previewLabel: "Preview",
    play: "Play",
    pause: "Pause",
    loop: "Loop",
    volume: "Volume",
    mute: "Mute",
    unmute: "Unmute",
    moreDetail: "More about IDX Composite",
    lunchBreak: "Lunch break",
    aboutTitle: "Profile",
    aboutText:
      "The IDX Composite is a stock index of all stocks listed on the Indonesia Stock Exchange, IDX.",
    wikipedia: "Wikipedia",
    newsTitle: "News stories",
    newsSubtitle: "From sources across the web",
    showMore: "Show more",
    showFewer: "Show fewer",
    minAgo: "minutes ago",
    hourAgo: "hours ago",
    dayAgo: "days ago",
    tabs: {
      "1D": "1D",
      "5D": "5D",
      "1M": "1M",
      "6M": "6M",
      YTD: "YTD",
      "1Y": "1Y",
      "5Y": "5Y",
      Max: "Max",
    },
    ranges: {
      "1D": "today",
      "5D": "past 5 days",
      "1M": "past month",
      "6M": "past 6 months",
      YTD: "year to date",
      "1Y": "past year",
      "5Y": "past 5 years",
      Max: "all time",
    },
  },
};
