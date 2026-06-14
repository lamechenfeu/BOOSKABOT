const fs = require("fs");
const path = require("path");

const DATA_DIR = "/data";
const DATA_FILE = path.join(DATA_DIR, "data.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      plugs: [],
      users: [],
      votes: []
    }, null, 2));
  }
}

function readData() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw || "{}");

    if (!data.plugs) data.plugs = [];
    if (!data.users) data.users = [];
    if (!data.votes) data.votes = [];

    return data;
  } catch (err) {
    console.error("Erreur lecture data.json :", err.message);
    return { plugs: [], users: [], votes: [] };
  }
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getPlugs() {
  const data = readData();
  return data.plugs || [];
}

function addPlug(plug) {
  const data = readData();

  const newPlug = {
    id: Date.now().toString(),
    name: plug.name || "",
    city: plug.city || "",
    sector: plug.sector || "",
    description: plug.description || "",
    telegram: plug.telegram || "",
    link: plug.link || plug.telegram || "",
    instagram: plug.instagram || "",
    potato: plug.potato || "",
    luffa: plug.luffa || "",
    image: plug.image || "",
    votes: 0,
    created_at: new Date().toISOString()
  };

  data.plugs.push(newPlug);
  writeData(data);

  return newPlug;
}

function updatePlug(id, updates) {
  const data = readData();
  const plug = data.plugs.find(p => String(p.id) === String(id));

  if (!plug) return null;

  Object.assign(plug, updates);
  writeData(data);

  return plug;
}

function deletePlug(id) {
  const data = readData();

  data.plugs = data.plugs.filter(p => String(p.id) !== String(id));
  data.votes = data.votes.filter(v => String(v.plugId) !== String(id));

  writeData(data);
  return true;
}

function votePlug(userId, plugId) {
  const data = readData();

  const plug = data.plugs.find(p => String(p.id) === String(plugId));
  if (!plug) {
    return { ok: false, reason: "plug_not_found" };
  }

  const alreadyVoted = data.votes.some(v =>
    String(v.userId) === String(userId) &&
    String(v.plugId) === String(plugId)
  );

  if (alreadyVoted) {
    return { ok: false, reason: "already_voted" };
  }

  data.votes.push({
    userId: String(userId),
    plugId: String(plugId),
    created_at: new Date().toISOString()
  });

  plug.votes = (plug.votes || 0) + 1;

  writeData(data);

  return { ok: true };
}

function makeBackup(reason = "auto") {
  ensureDataFile();

  const backupDir = path.join(DATA_DIR, "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(
    backupDir,
    `backup-${reason}-${Date.now()}.json`
  );

  fs.copyFileSync(DATA_FILE, backupFile);
  return backupFile;
}

module.exports = {
  readData,
  writeData,
  getPlugs,
  addPlug,
  updatePlug,
  deletePlug,
  votePlug,
  makeBackup
};