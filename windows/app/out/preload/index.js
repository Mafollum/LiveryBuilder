let electron = require("electron");
// src/preload/index.ts
var api = {
	ready: () => electron.ipcRenderer.send("app:ready"),
	isTest: process.env.LIVERY_TEST === "1",
	getLmuFolder: () => electron.ipcRenderer.invoke("lmu:getFolder"),
	chooseLmuFolder: () => electron.ipcRenderer.invoke("lmu:chooseFolder"),
	listTemplates: () => electron.ipcRenderer.invoke("templates:list"),
	openTemplate: (fileName) => electron.ipcRenderer.invoke("templates:open", fileName),
	openTemplateFile: (absPath) => electron.ipcRenderer.invoke("templates:openFile", absPath),
	chooseTemplateFile: () => electron.ipcRenderer.invoke("templates:chooseFile"),
	liveryStatus: () => electron.ipcRenderer.invoke("livery:status"),
	writeLivery: (paint, region, backup) => electron.ipcRenderer.invoke("livery:write", paint, region, backup),
	saveLiveryElsewhere: (paint, region) => electron.ipcRenderer.invoke("livery:saveElsewhere", paint, region),
	saveProject: (bytes, path, suggestedName) => electron.ipcRenderer.invoke("project:save", bytes, path, suggestedName),
	openProject: () => electron.ipcRenderer.invoke("project:open"),
	openRecentProject: (path) => electron.ipcRenderer.invoke("project:openRecent", path),
	listRecentProjects: () => electron.ipcRenderer.invoke("project:recent"),
	writeAutosave: (bytes) => electron.ipcRenderer.invoke("autosave:write", bytes),
	readAutosave: () => electron.ipcRenderer.invoke("autosave:read"),
	clearAutosave: () => electron.ipcRenderer.invoke("autosave:clear"),
	onCloseRequested: (cb) => {
		electron.ipcRenderer.removeAllListeners("app:close-requested");
		electron.ipcRenderer.on("app:close-requested", () => {
			electron.ipcRenderer.send("app:close-ack");
			cb();
		});
	},
	closeNow: () => electron.ipcRenderer.send("app:close-now"),
	autosaveMs: Number(process.env.LIVERY_AUTOSAVE_MS) || 6e4,
	loadBackgroundModel: () => electron.ipcRenderer.invoke("ai:backgroundModel")
};
electron.contextBridge.exposeInMainWorld("lmu", api);
