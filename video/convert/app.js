"use strict";

// ── Config ────────────────────────────────────────────────────────────────
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB per file (browser-memory bound)
const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

// Output format -> container ext, ffmpeg codec args, mime, uses CRF?
const FORMATS = {
  mp4:  { ext: "mp4",  mime: "video/mp4",        crf: true,
          args: (crf) => ["-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf), "-c:a", "aac", "-movflags", "+faststart"] },
  webm: { ext: "webm", mime: "video/webm",       crf: true,
          args: (crf) => ["-c:v", "libvpx-vp9", "-crf", String(crf), "-b:v", "0", "-row-mt", "1", "-c:a", "libopus"] },
  mov:  { ext: "mov",  mime: "video/quicktime",  crf: true,
          args: (crf) => ["-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf), "-c:a", "aac"] },
  mkv:  { ext: "mkv",  mime: "video/x-matroska", crf: true,
          args: (crf) => ["-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf), "-c:a", "aac"] },
  avi:  { ext: "avi",  mime: "video/x-msvideo",  crf: false,
          args: () => ["-c:v", "mpeg4", "-vtag", "xvid", "-q:v", "5", "-c:a", "libmp3lame"] },
  gif:  { ext: "gif",  mime: "image/gif",        crf: false,
          args: () => ["-vf", "fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"] },
};

// ── State ─────────────────────────────────────────────────────────────────
let items = []; // { id, file, base, inExt, original, status, progress, outBytes, outBlob, outName, error }
let nextId = 1;
let outFmt = "mp4";
let crf = 23;

let ffmpeg = null;
let ffmpegLoading = null;
let queue = [];
let processing = false;
let currentItem = null;

// ── Elements ──────────────────────────────────────────────────────────────
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const listEl = document.getElementById("list");
const toolbar = document.getElementById("toolbar");
const noteEl = document.getElementById("note");
const downloadAllBtn = document.getElementById("downloadAll");
const clearAllBtn = document.getElementById("clearAll");
const fmtButtons = Array.from(document.querySelectorAll(".fmt-btn"));
const qualityWrap = document.getElementById("qualityWrap");
const qualityInput = document.getElementById("quality");
const qualityVal = document.getElementById("qualityVal");
const loaderEl = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function outName(base) { return base + "." + FORMATS[outFmt].ext; }

function extOf(name) {
  const m = name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "mp4";
}

// ── FFmpeg loading (lazy, on first conversion) ─────────────────────────────
async function ensureFFmpeg() {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const { FFmpeg } = FFmpegWASM;
    const { toBlobURL } = FFmpegUtil;
    ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      if (currentItem) {
        currentItem.progress = Math.max(0, Math.min(1, progress || 0));
        render();
      }
    });
    loaderEl.hidden = false;
    loaderText.textContent = "Loading converter… (one-time ~30 MB download)";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    loaderEl.hidden = true;
    return ffmpeg;
  })();

  try {
    return await ffmpegLoading;
  } catch (e) {
    ffmpegLoading = null;
    loaderText.textContent = "Failed to load the converter. Check your connection and reload.";
    throw e;
  }
}

// ── Queue / conversion ─────────────────────────────────────────────────────
function enqueue(item) {
  item.status = "queued";
  queue.push(item);
  pump();
}

async function pump() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length) {
      const it = queue.shift();
      if (it.status === "queued" && items.includes(it)) {
        await processItem(it);
      }
    }
  } finally {
    processing = false;
  }
}

async function processItem(item) {
  let ff;
  try {
    ff = await ensureFFmpeg();
  } catch {
    item.status = "error";
    item.error = "Converter failed to load";
    render();
    return;
  }

  const fm = FORMATS[outFmt];
  const inName = `in_${item.id}.${item.inExt}`;
  const outFile = `out_${item.id}.${fm.ext}`;

  currentItem = item;
  item.status = "converting";
  item.progress = 0;
  item.error = null;
  item.outBlob = null;
  item.outBytes = null;
  item.outName = outName(item.base);
  render();

  try {
    const { fetchFile } = FFmpegUtil;
    await ff.writeFile(inName, await fetchFile(item.file));
    await ff.exec(["-i", inName, ...fm.args(crf), outFile]);
    const data = await ff.readFile(outFile); // Uint8Array
    if (!data || data.length === 0) throw new Error("No output produced");
    item.outBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    item.outBlob = new Blob([item.outBytes], { type: fm.mime });
    item.status = "done";
    item.progress = 1;
  } catch (e) {
    item.status = "error";
    item.error = (e && e.message) ? e.message : "Conversion failed";
  } finally {
    try { await ff.deleteFile(inName); } catch {}
    try { await ff.deleteFile(outFile); } catch {}
    currentItem = null;
    render();
  }
}

// ── File intake ───────────────────────────────────────────────────────────
function addFiles(fileList) {
  for (const file of Array.from(fileList)) {
    const base = file.name.replace(/\.[^.]+$/, "");
    const item = {
      id: nextId++,
      file,
      base,
      inExt: extOf(file.name),
      original: file.size,
      status: "queued",
      progress: 0,
      outBytes: null,
      outBlob: null,
      outName: outName(base),
      error: null,
    };

    if (!file.type.startsWith("video/")) {
      item.status = "error";
      item.error = "Not a video file";
    } else if (file.size > MAX_BYTES) {
      item.status = "error";
      item.error = `Too large (max ${fmtSize(MAX_BYTES)})`;
    }

    items.push(item);
    if (item.status === "queued") enqueue(item);
  }
  render();
}

function isHardError(it) {
  return it.error === "Not a video file" || (it.error && it.error.startsWith("Too large"));
}

function reconvertAll() {
  for (const it of items) {
    if (isHardError(it)) continue;
    it.outBlob = null;
    it.outBytes = null;
    it.outName = outName(it.base);
    enqueue(it);
  }
  render();
}

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  listEl.innerHTML = "";
  for (const it of items) {
    const li = document.createElement("li");
    li.className = "item";

    const meta = document.createElement("div");
    meta.className = "meta";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = it.outName;
    meta.appendChild(name);

    if (it.status === "error") {
      const err = document.createElement("div");
      err.className = "err";
      err.textContent = "⚠ " + it.error;
      meta.appendChild(err);
    } else if (it.status === "converting") {
      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("div");
      fill.style.width = Math.round(it.progress * 100) + "%";
      bar.appendChild(fill);
      meta.appendChild(bar);
      const lbl = document.createElement("div");
      lbl.className = "bar-label";
      lbl.textContent = `converting… ${Math.round(it.progress * 100)}%`;
      meta.appendChild(lbl);
    } else if (it.status === "queued") {
      const q = document.createElement("div");
      q.className = "queued";
      q.textContent = "queued…";
      meta.appendChild(q);
    } else if (it.status === "done" && it.outBytes) {
      const sizes = document.createElement("div");
      sizes.className = "sizes";
      sizes.innerHTML = `${fmtSize(it.original)} <span class="arrow">→</span> ${fmtSize(it.outBytes.length)}`;
      meta.appendChild(sizes);
    }

    li.appendChild(meta);

    if (it.status === "done" && it.outBlob) {
      const a = document.createElement("a");
      a.className = "dl";
      a.textContent = "Download";
      a.href = URL.createObjectURL(it.outBlob);
      a.download = it.outName;
      li.appendChild(a);
    } else {
      const span = document.createElement("span");
      span.className = "dl disabled";
      span.textContent = "Download";
      li.appendChild(span);
    }

    listEl.appendChild(li);
  }

  const hasAny = items.length > 0;
  const ready = items.filter((i) => i.status === "done" && i.outBytes);
  toolbar.hidden = !hasAny;
  noteEl.hidden = !hasAny;
  downloadAllBtn.disabled = ready.length < 1;
  downloadAllBtn.textContent = ready.length > 1 ? "Download all (.zip)" : "Download (.zip)";
}

// ── Format / quality controls ─────────────────────────────────────────────
function setFormat(fmt) {
  outFmt = fmt;
  fmtButtons.forEach((b) => b.classList.toggle("active", b.dataset.fmt === fmt));
  qualityWrap.hidden = !FORMATS[fmt].crf;
  if (items.length) reconvertAll();
}

fmtButtons.forEach((b) => b.addEventListener("click", () => setFormat(b.dataset.fmt)));

qualityInput.addEventListener("input", () => {
  crf = parseInt(qualityInput.value, 10);
  qualityVal.textContent = String(crf);
});
qualityInput.addEventListener("change", () => {
  if (FORMATS[outFmt].crf && items.length) reconvertAll();
});

// ── ZIP writer (store method, no dependencies) ─────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  const enc = new TextEncoder();
  const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

  const chunks = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.bytes);
    const size = e.bytes.length;

    const local = [].concat(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0)
    );
    chunks.push(new Uint8Array(local), nameBytes, e.bytes);

    const cd = [].concat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset)
    );
    central.push(new Uint8Array(cd), nameBytes);
    offset += local.length + nameBytes.length + size;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) { chunks.push(c); cdSize += c.length; }

  const eocd = [].concat(
    u32(0x06054b50), u16(0), u16(0),
    u16(entries.length), u16(entries.length),
    u32(cdSize), u32(cdStart), u16(0)
  );
  chunks.push(new Uint8Array(eocd));

  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

function downloadAll() {
  const ready = items.filter((i) => i.status === "done" && i.outBytes);
  if (ready.length === 0) return;

  const seen = new Map();
  const ext = "." + FORMATS[outFmt].ext;
  const entries = [];
  for (const it of ready) {
    let name = it.outName;
    if (seen.has(name)) {
      const n = seen.get(name) + 1;
      seen.set(name, n);
      name = name.replace(new RegExp(ext.replace(".", "\\.") + "$"), `_${n}${ext}`);
    } else {
      seen.set(name, 1);
    }
    entries.push({ name, bytes: it.outBytes });
  }

  const zipBytes = buildZip(entries);
  const blob = new Blob([zipBytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `converted-${outFmt}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearAll() {
  items = [];
  queue = [];
  fileInput.value = "";
  render();
}

// ── Events ────────────────────────────────────────────────────────────────
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener("change", (e) => addFiles(e.target.files));

["dragenter", "dragover"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); })
);
dropzone.addEventListener("drop", (e) => {
  if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
});

downloadAllBtn.addEventListener("click", downloadAll);
clearAllBtn.addEventListener("click", clearAll);

// ── Init ──────────────────────────────────────────────────────────────────
setFormat("mp4");
render();