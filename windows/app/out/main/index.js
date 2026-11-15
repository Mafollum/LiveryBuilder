const require_rolldown_runtime = require("./rolldown-runtime-Bc0pwXKd.js");
let electron = require("electron");
let node_path = require("node:path");
node_path = require_rolldown_runtime.__toESM(node_path);
let node_fs = require("node:fs");
node_fs = require_rolldown_runtime.__toESM(node_fs);
let node_worker_threads = require("node:worker_threads");
let node_crypto = require("node:crypto");
let node_zlib = require("node:zlib");
// src/main/lmu/findLmu.ts
var DEFAULT_STEAM = "C:\\Program Files (x86)\\Steam";
var LMU_SUBPATH = "steamapps\\common\\Le Mans Ultimate";
/** Reads the "path" entries from Steam's libraryfolders.vdf. */
function parseLibraryFolders(vdf) {
	const out = [];
	const re = /"path"\s+"((?:[^"\\]|\\.)*)"/g;
	for (let m = re.exec(vdf); m; m = re.exec(vdf)) out.push(m[1].replace(/\\\\/g, "\\"));
	return out;
}
var isLmuFolder = (fsx, folder) => fsx.exists(node_path.default.win32.join(folder, "Support", "LiveryTemplates"));
/** Looks for Le Mans Ultimate in the default Steam folder, then every Steam library. */
function findLmuFolder(fsx) {
	const candidates = [node_path.default.win32.join(DEFAULT_STEAM, LMU_SUBPATH)];
	const vdf = fsx.readText(node_path.default.win32.join(DEFAULT_STEAM, "steamapps", "libraryfolders.vdf"));
	if (vdf) for (const lib of parseLibraryFolders(vdf)) candidates.push(node_path.default.win32.join(lib, LMU_SUBPATH));
	return candidates.find((c) => isLmuFolder(fsx, c)) ?? null;
}
// src/main/settings.ts
var file = (dir) => (0, node_path.join)(dir, "settings.json");
function loadSettings(dir) {
	try {
		if ((0, node_fs.existsSync)(file(dir))) {
			const s = JSON.parse((0, node_fs.readFileSync)(file(dir), "utf8"));
			return {
				lmuFolder: s.lmuFolder,
				recentProjects: Array.isArray(s.recentProjects) ? s.recentProjects : []
			};
		}
	} catch {}
	return { recentProjects: [] };
}
function saveSettings(dir, s) {
	(0, node_fs.mkdirSync)(dir, { recursive: true });
	(0, node_fs.writeFileSync)(file(dir), JSON.stringify(s, null, 2));
}
// src/main/templates/carName.ts
var CLASS_TOKENS = {
	HYPER: "Hypercar",
	LMP2: "LMP2",
	LMP3: "LMP3",
	GT3: "GT3",
	GTE: "GTE"
};
var VARIANT = /^(\d{4}|ELMS|EVO)$/i;
var OVERRIDES = [
	["BMWM4", "BMW M4"],
	["BMWM Hybrid", "BMW M Hybrid"],
	["Mc Laren", "McLaren"]
];
var isUpper = (c) => !!c && c >= "A" && c <= "Z";
var isLower = (c) => !!c && c >= "a" && c <= "z";
var isDigit = (c) => !!c && c >= "0" && c <= "9";
var isLetter = (c) => isUpper(c) || isLower(c);
/** Splits a camel-case model token ("Ferrari296LMGT3") into words ("Ferrari 296 LMGT3"). */
function splitWords(token) {
	let out = token[0] ?? "";
	for (let i = 1; i < token.length; i++) {
		const prev = token[i - 1];
		const cur = token[i];
		const next = token[i + 1];
		let split = false;
		if (isLower(prev) && isUpper(cur)) split = true;
		else if (isUpper(prev) && isUpper(cur) && isLower(next)) split = true;
		else if (isLetter(prev) && isDigit(cur)) {
			const word = out.slice(out.lastIndexOf(" ") + 1);
			const run = /[A-Za-z]+$/.exec(word)?.[0] ?? "";
			split = run.length >= 2 && /[a-z]/.test(run);
		} else if (isDigit(prev) && isUpper(cur) && (isUpper(next) || isLower(next))) split = true;
		out += (split ? " " : "") + cur;
	}
	return out;
}
/** Turns "Template_GT3_Ferrari296LMGT3_2025_ELMS.psd" into { GT3, "Ferrari 296 LMGT3 — 2025 ELMS" }. */
function carDisplayName(fileName) {
	const base = fileName.replace(/\.psd$/i, "").replace(/^Template_/i, "");
	const tokens = base.split("_").map((t) => t.trim()).filter(Boolean);
	const carClass = CLASS_TOKENS[(tokens[0] ?? "").toUpperCase()] ?? "Other";
	const rest = tokens.slice(1);
	const variants = rest.filter((t) => VARIANT.test(t));
	let model = rest.filter((t) => !VARIANT.test(t)).map(splitWords).join(" ");
	for (const [from, to] of OVERRIDES) model = model.replace(from, to);
	if (!model) model = base;
	return {
		carClass,
		label: variants.length ? `${model} — ${variants.join(" ")}` : model
	};
}
// src/main/templates/listTemplates.ts
var templatesDir = (lmuFolder) => (0, node_path.join)(lmuFolder, "Support", "LiveryTemplates");
/** Every Template_*.psd in <lmu>/Support/LiveryTemplates with its readable name. */
function listTemplates(lmuFolder) {
	const dir = templatesDir(lmuFolder);
	if (!(0, node_fs.existsSync)(dir)) return [];
	return (0, node_fs.readdirSync)(dir).filter((f) => /^Template_.*\.psd$/i.test(f)).map((fileName) => {
		const st = (0, node_fs.statSync)((0, node_path.join)(dir, fileName));
		return {
			fileName,
			...carDisplayName(fileName),
			sizeBytes: st.size,
			mtimeMs: Math.floor(st.mtimeMs)
		};
	});
}
// ./panelWorker?nodeWorker&importer=/home/user/LiveryBuilder/src/main/templates/openTemplate.ts
function openTemplate_default(options) {
	return new node_worker_threads.Worker(new URL("./panelWorker-D2Ta5gW3.js", require("url").pathToFileURL(__filename).href), options);
}
// src/main/templates/panelCache.ts
function cacheKey(t) {
	return (0, node_crypto.createHash)("sha1").update(`v2|${t.fileName}|${t.sizeBytes}|${t.mtimeMs}`).digest("hex");
}
var fileFor = (dir, key) => (0, node_path.join)(dir, "panel-cache", `${key}.bin`);
function pack(panel) {
	const out = new Uint8Array(Math.ceil(panel.length / 8));
	for (let i = 0; i < panel.length; i++) if (panel[i]) out[i >> 3] |= 1 << (i & 7);
	return out;
}
function unpack(bits, n) {
	const out = new Uint8Array(n);
	for (let i = 0; i < n; i++) out[i] = bits[i >> 3] >> (i & 7) & 1;
	return out;
}
/** Stores a panel map as one JSON header line followed by the zlib-compressed, bit-packed map. */
function writeCachedPanel(dir, key, data) {
	const { panel, ...meta } = data;
	(0, node_fs.mkdirSync)((0, node_path.join)(dir, "panel-cache"), { recursive: true });
	const header = Buffer.from(JSON.stringify(meta) + "\n", "utf8");
	const body = (0, node_zlib.deflateSync)(pack(panel));
	const target = fileFor(dir, key);
	const tmp = `${target}.tmp-${process.pid}`;
	(0, node_fs.writeFileSync)(tmp, Buffer.concat([header, body]));
	(0, node_fs.renameSync)(tmp, target);
}
function readCachedPanel(dir, key) {
	const file = fileFor(dir, key);
	if (!(0, node_fs.existsSync)(file)) return null;
	try {
		const buf = (0, node_fs.readFileSync)(file);
		const nl = buf.indexOf(10);
		if (nl < 0) return null;
		const meta = JSON.parse(buf.subarray(0, nl).toString("utf8"));
		if (!meta.width || !meta.height) return null;
		const bits = new Uint8Array((0, node_zlib.inflateSync)(buf.subarray(nl + 1)));
		return {
			...meta,
			panel: unpack(bits, meta.width * meta.height)
		};
	} catch {
		return null;
	}
}
// src/main/templates/openTemplate.ts
function runWorker(path) {
	return new Promise((resolve, reject) => {
		const worker = openTemplate_default({ workerData: { path } });
		worker.once("message", (msg) => {
			worker.terminate();
			if (msg.ok) resolve({
				...msg.data,
				panel: new Uint8Array(msg.data.panel)
			});
			else reject(new Error(msg.message));
		});
		worker.once("error", reject);
	});
}
/** Panel data for a template file: from the cache when the file is unchanged, else computed in a worker. */
async function openTemplateAt(path, userData) {
	const st = (0, node_fs.statSync)(path);
	const key = cacheKey({
		fileName: (0, node_path.basename)(path),
		sizeBytes: st.size,
		mtimeMs: Math.floor(st.mtimeMs)
	});
	const cached = readCachedPanel(userData, key);
	if (cached) return cached;
	const data = await runWorker(path);
	try {
		writeCachedPanel(userData, key, data);
	} catch {}
	return data;
}
// src/main/livery/writeLivery.ts
var PAINT_FILE = "customskin.tga";
var REGION_FILE = "customskin_region.tga";
function liveryStatus(lmuFolder) {
	const folder = (0, node_path.join)(lmuFolder, "UserData", "Liveries");
	return {
		folder,
		exists: (0, node_fs.existsSync)((0, node_path.join)(folder, PAINT_FILE))
	};
}
var pad = (n) => String(n).padStart(2, "0");
var stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Windows briefly refuses renames while another program (antivirus, the game) has the file open. */
var TRANSIENT = /* @__PURE__ */ new Set([
	"EPERM",
	"EACCES",
	"EBUSY"
]);
var ATTEMPTS = 5;
async function renameWithRetry(fsx, from, to, delayMs) {
	for (let attempt = 1;; attempt++) try {
		fsx.renameSync(from, to);
		return;
	} catch (e) {
		const code = e.code ?? "";
		if (!TRANSIENT.has(code) || attempt >= ATTEMPTS) throw e;
		await sleep(delayMs * attempt);
	}
}
function quietly(f) {
	try {
		f();
	} catch {}
}
/**
* Writes the paint and finish files into the folder as a pair. Both are written under temporary
* names first; the old files are moved aside, the new ones moved in, and on any failure the old
* pair is put back — so the game never sees a half-written file or a mismatched pair.
*/
async function writeLiveryFiles(folder, paint, region, opts, fsx = node_fs) {
	const delay = opts.retryDelayMs ?? 100;
	fsx.mkdirSync(folder, { recursive: true });
	if (opts.backup) {
		const s = stamp(opts.now ?? /* @__PURE__ */ new Date());
		for (const [file, backup] of [[PAINT_FILE, `customskin_backup_${s}.tga`], [REGION_FILE, `customskin_region_backup_${s}.tga`]]) if (fsx.existsSync((0, node_path.join)(folder, file))) fsx.copyFileSync((0, node_path.join)(folder, file), (0, node_path.join)(folder, backup));
	}
	const files = [{
		target: (0, node_path.join)(folder, PAINT_FILE),
		bytes: paint
	}, {
		target: (0, node_path.join)(folder, REGION_FILE),
		bytes: region
	}].map((f) => ({
		...f,
		tmp: `${f.target}.tmp-${process.pid}`,
		prev: `${f.target}.prev-${process.pid}`,
		movedAside: false,
		placed: false
	}));
	const cleanTemps = () => files.forEach((f) => quietly(() => fsx.existsSync(f.tmp) && fsx.unlinkSync(f.tmp)));
	try {
		for (const f of files) fsx.writeFileSync(f.tmp, f.bytes);
		for (const f of files) if (fsx.existsSync(f.target)) {
			await renameWithRetry(fsx, f.target, f.prev, delay);
			f.movedAside = true;
		}
		for (const f of files) {
			await renameWithRetry(fsx, f.tmp, f.target, delay);
			f.placed = true;
		}
	} catch (e) {
		for (const f of files) {
			if (f.placed && !f.movedAside) quietly(() => fsx.unlinkSync(f.target));
			if (f.movedAside) quietly(() => fsx.renameSync(f.prev, f.target));
		}
		cleanTemps();
		throw e;
	}
	for (const f of files) if (f.movedAside) quietly(() => fsx.unlinkSync(f.prev));
}
function describeWriteError(e) {
	switch (e.code) {
		case "EPERM":
		case "EACCES": return "Windows didn't allow writing to the game folder. If the game is showing this livery, leave the showroom and try again.";
		case "EBUSY": return "The game is using the file right now. Leave the showroom or close the game, then try again.";
		case "ENOSPC": return "The disk is full.";
		case "ENOTDIR":
		case "EEXIST": return "The game's Liveries folder couldn't be used: something else with that name is in the way.";
		default: return `Something went wrong (${e.code ?? e.message}).`;
	}
}
// src/main/ipc.ts
var NOT_LMU = "That folder doesn't look like Le Mans Ultimate (there's no Support\\LiveryTemplates inside).";
var lmuOverride = process.env.LIVERY_LMU_DIR || null;
function currentLmuFolder() {
	if (lmuOverride) return lmuOverride;
	const settings = loadSettings(electron.app.getPath("userData"));
	if (settings.lmuFolder && (0, node_fs.existsSync)(settings.lmuFolder)) return settings.lmuFolder;
	const found = findLmuFolder({
		exists: (p) => (0, node_fs.existsSync)(p),
		readText: (p) => (0, node_fs.existsSync)(p) ? (0, node_fs.readFileSync)(p, "utf8") : null
	});
	if (found) saveSettings(electron.app.getPath("userData"), {
		...settings,
		lmuFolder: found
	});
	return found;
}
function registerIpc() {
	electron.ipcMain.handle("lmu:getFolder", () => currentLmuFolder());
	electron.ipcMain.handle("lmu:chooseFolder", async (e) => {
		const win = electron.BrowserWindow.fromWebContents(e.sender) ?? void 0;
		const res = await electron.dialog.showOpenDialog(win, {
			title: "Choose your Le Mans Ultimate folder",
			properties: ["openDirectory"]
		});
		if (res.canceled || !res.filePaths[0]) return null;
		const folder = res.filePaths[0];
		if (!(0, node_fs.existsSync)(templatesDir(folder))) return { error: NOT_LMU };
		const settings = loadSettings(electron.app.getPath("userData"));
		saveSettings(electron.app.getPath("userData"), {
			...settings,
			lmuFolder: folder
		});
		lmuOverride = null;
		return { folder };
	});
	electron.ipcMain.handle("templates:list", () => {
		const lmu = currentLmuFolder();
		return lmu ? listTemplates(lmu) : [];
	});
	electron.ipcMain.handle("templates:open", (_e, fileName) => {
		const lmu = currentLmuFolder();
		if (!lmu) throw new Error("Le Mans Ultimate folder not set");
		return openTemplateAt((0, node_path.join)(templatesDir(lmu), fileName), electron.app.getPath("userData"));
	});
	electron.ipcMain.handle("livery:status", () => {
		const lmu = currentLmuFolder();
		if (!lmu) throw new Error("Le Mans Ultimate folder not set");
		return liveryStatus(lmu);
	});
	electron.ipcMain.handle("livery:write", async (_e, paint, region, backup) => {
		const lmu = currentLmuFolder();
		if (!lmu) return {
			ok: false,
			message: "Couldn't find the Le Mans Ultimate folder."
		};
		try {
			await writeLiveryFiles(liveryStatus(lmu).folder, paint, region, { backup });
			return { ok: true };
		} catch (err) {
			return {
				ok: false,
				message: describeWriteError(err)
			};
		}
	});
	electron.ipcMain.handle("livery:saveElsewhere", async (e, paint, region) => {
		const win = electron.BrowserWindow.fromWebContents(e.sender) ?? void 0;
		const res = await electron.dialog.showOpenDialog(win, {
			title: "Choose a folder for the two livery files",
			properties: ["openDirectory", "createDirectory"]
		});
		if (res.canceled || !res.filePaths[0]) return null;
		try {
			await writeLiveryFiles(res.filePaths[0], paint, region, { backup: false });
			return {
				ok: true,
				folder: res.filePaths[0]
			};
		} catch (err) {
			return {
				ok: false,
				message: describeWriteError(err)
			};
		}
	});
	electron.ipcMain.handle("templates:openFile", (_e, absPath) => openTemplateAt(absPath, electron.app.getPath("userData")));
	electron.ipcMain.handle("templates:chooseFile", async (e) => {
		const win = electron.BrowserWindow.fromWebContents(e.sender) ?? void 0;
		const res = await electron.dialog.showOpenDialog(win, {
			title: "Choose a car template",
			properties: ["openFile"],
			filters: [{
				name: "Car templates",
				extensions: ["psd"]
			}]
		});
		return res.canceled || !res.filePaths[0] ? null : res.filePaths[0];
	});
}
// src/main/project/projectIo.ts
var MAX_RECENT = 8;
var FILTERS = [{
	name: "Livery projects",
	extensions: ["lmulivery"]
}];
var autosaveFile = () => (0, node_path.join)(electron.app.getPath("userData"), "autosave.lmulivery");
var defaultProjectDir = () => (0, node_path.join)(electron.app.getPath("documents"), "LMU Livery Builder");
function addRecent(path) {
	const dir = electron.app.getPath("userData");
	const s = loadSettings(dir);
	saveSettings(dir, {
		...s,
		recentProjects: [path, ...s.recentProjects.filter((p) => p !== path)].slice(0, MAX_RECENT)
	});
}
function removeRecent(path) {
	const dir = electron.app.getPath("userData");
	const s = loadSettings(dir);
	saveSettings(dir, {
		...s,
		recentProjects: s.recentProjects.filter((p) => p !== path)
	});
}
function writeAtomic(path, bytes) {
	(0, node_fs.mkdirSync)((0, node_path.dirname)(path), { recursive: true });
	const tmp = `${path}.tmp-${process.pid}`;
	(0, node_fs.writeFileSync)(tmp, bytes);
	(0, node_fs.renameSync)(tmp, path);
}
var safeName = (name) => name.replace(/[<>:"/\\|?*]+/g, "").trim() || "Livery";
function registerProjectIpc() {
	electron.ipcMain.handle("project:save", async (e, bytes, path, suggestedName) => {
		let target = path;
		if (!target) {
			const win = electron.BrowserWindow.fromWebContents(e.sender) ?? void 0;
			(0, node_fs.mkdirSync)(defaultProjectDir(), { recursive: true });
			const res = await electron.dialog.showSaveDialog(win, {
				title: "Save livery project",
				defaultPath: (0, node_path.join)(defaultProjectDir(), `${safeName(suggestedName)}.lmulivery`),
				filters: FILTERS
			});
			if (res.canceled || !res.filePath) return null;
			target = res.filePath.endsWith(".lmulivery") ? res.filePath : `${res.filePath}.lmulivery`;
		}
		writeAtomic(target, bytes);
		addRecent(target);
		return target;
	});
	electron.ipcMain.handle("project:open", async (e) => {
		const win = electron.BrowserWindow.fromWebContents(e.sender) ?? void 0;
		const res = await electron.dialog.showOpenDialog(win, {
			title: "Open livery project",
			defaultPath: defaultProjectDir(),
			properties: ["openFile"],
			filters: FILTERS
		});
		if (res.canceled || !res.filePaths[0]) return null;
		const path = res.filePaths[0];
		addRecent(path);
		return {
			path,
			bytes: new Uint8Array((0, node_fs.readFileSync)(path))
		};
	});
	electron.ipcMain.handle("project:openRecent", (_e, path) => {
		if (!(0, node_fs.existsSync)(path)) {
			removeRecent(path);
			return null;
		}
		addRecent(path);
		return {
			path,
			bytes: new Uint8Array((0, node_fs.readFileSync)(path))
		};
	});
	electron.ipcMain.handle("project:recent", () => loadSettings(electron.app.getPath("userData")).recentProjects.filter((p) => (0, node_fs.existsSync)(p)));
	electron.ipcMain.handle("autosave:write", (_e, bytes) => writeAtomic(autosaveFile(), bytes));
	electron.ipcMain.handle("autosave:read", () => (0, node_fs.existsSync)(autosaveFile()) ? new Uint8Array((0, node_fs.readFileSync)(autosaveFile())) : null);
	electron.ipcMain.handle("autosave:clear", () => (0, node_fs.rmSync)(autosaveFile(), { force: true }));
}
// src/main/index.ts
var smokeTest = process.argv.includes("--smoke-test");
var quitting = false;
var allowClose = false;
var CLOSE_ACK_MS = 2e3;
electron.app.setName("LiveryBuilder");
if (process.env.LIVERY_USER_DATA) electron.app.setPath("userData", process.env.LIVERY_USER_DATA);
if (process.env.LIVERY_DOCUMENTS) electron.app.setPath("documents", process.env.LIVERY_DOCUMENTS);
function createWindow() {
	const win = new electron.BrowserWindow({
		width: 1400,
		height: 900,
		title: "LMU Livery Builder",
		webPreferences: {
			preload: (0, node_path.join)(__dirname, "../preload/index.js"),
			contextIsolation: true,
			sandbox: false
		}
	});
	win.setMenuBarVisibility(false);
	let rendererGone = false;
	let ackTimer = null;
	win.webContents.on("render-process-gone", () => {
		rendererGone = true;
	});
	win.on("close", (e) => {
		if (allowClose || quitting || smokeTest || rendererGone || win.webContents.isCrashed()) return;
		e.preventDefault();
		win.webContents.send("app:close-requested");
		if (ackTimer) clearTimeout(ackTimer);
		ackTimer = setTimeout(() => {
			allowClose = true;
			win.close();
		}, CLOSE_ACK_MS);
	});
	electron.ipcMain.removeAllListeners("app:close-ack");
	electron.ipcMain.on("app:close-ack", () => {
		if (ackTimer) clearTimeout(ackTimer);
		ackTimer = null;
	});
	if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
	else win.loadFile((0, node_path.join)(__dirname, "../renderer/index.html"));
	return win;
}
electron.ipcMain.on("app:close-now", (e) => {
	allowClose = true;
	electron.BrowserWindow.fromWebContents(e.sender)?.close();
});
electron.app.on("before-quit", () => {
	quitting = true;
});
electron.ipcMain.on("app:ready", () => {
	if (smokeTest) electron.app.exit(0);
});
if (smokeTest) setTimeout(() => electron.app.exit(1), 3e4);
electron.app.whenReady().then(() => {
	registerIpc();
	registerProjectIpc();
	createWindow();
});
electron.app.on("window-all-closed", () => electron.app.quit());
