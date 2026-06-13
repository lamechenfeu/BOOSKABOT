const fs = require("fs");
const path = require("path");

const DATA_DIR = "/data";
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const LOCAL_DATA_FILE = path.join(__dirname, "data.json");
const DATA_FILE = path.join(DATA_DIR, "data.json");

const MAX_BACKUPS = 30;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function defaultData() {
  return {
    users: [],
    votes: [],
    plugVotes: [],
    plugs: [],
    settings: {},
    created_at: new Date().toISOString()
  };
}

function safeReadJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return null;
  }
}

function cleanOldBackups() {
  ensureDirs();

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith(".json"))
    .map(file => {
      const fullPath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(fullPath);

      return {
        file,
        fullPath,
        time: stat.mtime.getTime()
      };
    })
    .sort((a, b) => b.time - a.time);

  const oldFiles = files.slice(MAX_BACKUPS);

  oldFiles.forEach(item => {
    try {
      fs.unlinkSync(item.fullPath);
    } catch (err) {
      console.error("Erreur suppression ancien backup :", err.message);
    }
  });
}

function makeBackup(reason = "auto") {
  ensureDirs();

  if (!fs.existsSync(DATA_FILE)) return null;

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(BACKUP_DIR, `backup-${reason}-${stamp}.json`);

  fs.copyFileSync(DATA_FILE, backupFile);
  cleanOldBackups();

  return backupFile;
}

function initData() {
  ensureDirs();

  let data = safeReadJson(DATA_FILE);

  if (!data) {
    const localData = safeReadJson(LOCAL_DATA_FILE);
    data = localData || defaultData();

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  }

  if (!data.users) data.users = [];
  if (!data.votes) data.votes = [];
  if (!data.plugVotes) data.plugVotes = [];
  if (!data.plugs) data.plugs = [];
  if (!data.settings) data.settings = {};

  data.plugs = data.plugs.map(plug => ({
    ...plug,
    votes: Number(plug.votes || 0)
  }));

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function readData() {
  initData();

  const data = safeReadJson(DATA_FILE);

  if (!data) {
    const brokenFile = path.join(BACKUP_DIR, `corrupted-${Date.now()}.json`);

    if (fs.existsSync(DATA_FILE)) {
      fs.copyFileSync(DATA_FILE, brokenFile);
    }

    const freshData = defaultData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(freshData, null, 2));
    cleanOldBackups();

    return freshData;
  }

  return data;
}

function writeData(data) {
  ensureDirs();

  if (fs.existsSync(DATA_FILE)) {
    makeBackup("before-write");
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  cleanOldBackups();
}

function dailyBackup() {
  ensureDirs();

  const today = new Date().toISOString().slice(0, 10);
  const backupFile = path.join(BACKUP_DIR, `daily-${today}.json`);

  if (!fs.existsSync(backupFile) && fs.existsSync(DATA_FILE)) {
    fs.copyFileSync(DATA_FILE, backupFile);
    cleanOldBackups();
  }
}

dailyBackup();

module.exports = {
  readData,
  writeData,
  makeBackup,
  dailyBackup,
  cleanOldBackups,

  addPlug(plug) {
    const data = readData();

    const newPlug = {
      id: Date.now(),
      name: plug.name || "",
      sector: plug.sector || "",
      city: plug.city || "",
      description: plug.description || "",
      image: plug.image || "",
      telegram: plug.telegram || "",
      link: plug.link || plug.telegram || "",
      instagram: plug.instagram || "",
      potato: plug.potato || "",
      luffa: plug.luffa || "",
      votes: plug.votes || 0,
      created_at: new Date().toISOString()
    };

    data.plugs.push(newPlug);
    writeData(data);
    return newPlug;
  },

  getPlugs() {
    const data = readData();

    return (data.plugs || [])
      .map(plug => ({
        ...plug,
        votes: Number(plug.votes || 0)
      }))
      .sort((a, b) => (b.votes || 0) - (a.votes || 0));
  },

  getPlug(id) {
    const data = readData();
    return (data.plugs || []).find(p => String(p.id) === String(id)) || null;
  },

  updatePlug(id, updates) {
    const data = readData();
    const plug = data.plugs.find(p => String(p.id) === String(id));

    if (!plug) return null;

    Object.assign(plug, updates);
    plug.votes = Number(plug.votes || 0);

    writeData(data);

    return plug;
  },

  deletePlug(id) {
    const data = readData();

    data.plugs = data.plugs.filter(p => String(p.id) !== String(id));
    data.plugVotes = (data.plugVotes || []).filter(v => String(v.plug_id) !== String(id));

    writeData(data);
  },

  votePlug(userId, plugId) {
    const data = readData();

    if (!data.plugVotes) data.plugVotes = [];

    const plug = data.plugs.find(p => String(p.id) === String(plugId));

    if (!plug) {
      return {
        ok: false,
        reason: "not_found"
      };
    }

    const existingVote = data.plugVotes.find(v => {
      return String(v.user_id) === String(userId) &&
        String(v.plug_id) === String(plugId);
    });

    if (existingVote) {
      return {
        ok: false,
        reason: "already_voted",
        plug
      };
    }

    data.plugVotes.push({
      id: Date.now(),
      user_id: userId,
      plug_id: plugId,
      created_at: new Date().toISOString()
    });

    plug.votes = Number(plug.votes || 0) + 1;

    writeData(data);

    return {
      ok: true,
      plug
    };
  },

  hasUserVotedPlug(userId, plugId) {
    const data = readData();

    return (data.plugVotes || []).some(v => {
      return String(v.user_id) === String(userId) &&
        String(v.plug_id) === String(plugId);
    });
  },

  get(query, params, callback) {
    const data = readData();

    if (query.includes("COUNT(*)")) {
      return callback(null, { count: data.votes.length });
    }

    if (query.includes("FROM votes WHERE user_id")) {
      const vote = data.votes.find(v => String(v.user_id) === String(params[0]));
      return callback(null, vote || undefined);
    }

    callback(null, undefined);
  },

  run(query, params) {
    const data = readData();

    if (query.includes("INSERT INTO votes")) {
      data.votes.push({
        id: Date.now(),
        user_id: params[0],
        created_at: new Date().toISOString()
      });

      writeData(data);
    }
  }
};