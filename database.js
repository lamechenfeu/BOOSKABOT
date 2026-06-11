const fs = require("fs");
const path = require("path");

const dataFile = path.join(__dirname, "data.json");

// Crée le fichier s'il n'existe pas
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(
    dataFile,
    JSON.stringify(
      {
        users: [],
        votes: []
      },
      null,
      2
    )
  );
}

function readData() {
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

module.exports = {
  serialize(callback) {
    callback();
  },

  run(query, params) {
    const data = readData();

    // INSERT INTO votes
    if (query.includes("INSERT INTO votes")) {
      data.votes.push({
        id: Date.now(),
        user_id: params[0],
        plug: params[1] || null
      });

      writeData(data);
    }
  },

  get(query, params, callback) {
    const data = readData();

    // SELECT COUNT(*) as count FROM votes
    if (query.includes("COUNT(*)")) {
      return callback(null, {
        count: data.votes.length
      });
    }

    // SELECT * FROM votes WHERE user_id = ?
    if (query.includes("FROM votes WHERE user_id")) {
      const vote = data.votes.find(
        v => String(v.user_id) === String(params[0])
      );

      return callback(null, vote || undefined);
    }

    callback(null, undefined);
  }
};