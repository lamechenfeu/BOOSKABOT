const fs = require("fs");
const path = require("path");

const dataFile = path.join(__dirname, "data.json");

function initData() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(
      dataFile,
      JSON.stringify(
        {
          users: [],
          votes: [],
          plugs: []
        },
        null,
        2
      )
    );
  }
}

function readData() {
  initData();
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

module.exports = {
  readData,
  writeData,

  addPlug(plug) {
    const data = readData();

    const newPlug = {
      id: Date.now(),
      name: plug.name,
      city: plug.city || "France",
      image: plug.image || "",
      link: plug.link || "",
      votes: 0,
      created_at: new Date().toISOString()
    };

    data.plugs.push(newPlug);
    writeData(data);

    return newPlug;
  },

  getPlugs() {
    const data = readData();
    return data.plugs || [];
  },

  deletePlug(id) {
    const data = readData();
    data.plugs = data.plugs.filter(p => String(p.id) !== String(id));
    writeData(data);
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