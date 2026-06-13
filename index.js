require('dotenv').config();

const { Telegraf } = require('telegraf');
const db = require('./database');
const http = require("http");
const fs = require("fs");

const BOT_URL = "https://booskabot.vercel.app";

const bot = new Telegraf(process.env.BOT_TOKEN);

const accessBot = process.env.ACCESS_BOT_TOKEN
  ? new Telegraf(process.env.ACCESS_BOT_TOKEN)
  : null;

const MAIN_BOT_USERNAME = process.env.MAIN_BOT_USERNAME || "";

//////////////////////////////
// 👤 SAUVEGARDE UTILISATEUR
//////////////////////////////

function saveUser(ctx) {
  try {
    if (!ctx.from) return;

    const data = db.readData();

    if (!data.users) data.users = [];

    const user = ctx.from;
    const existing = data.users.find(u => String(u.id) === String(user.id));

    const userData = {
      id: user.id,
      username: user.username || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      language_code: user.language_code || "",
      is_bot: user.is_bot || false,
      last_seen_at: new Date().toISOString()
    };

    if (existing) {
      Object.assign(existing, userData);
    } else {
      data.users.push({
        ...userData,
        created_at: new Date().toISOString()
      });
    }

    db.writeData(data);
  } catch (err) {
    console.error("Erreur sauvegarde utilisateur :", err.message);
  }
}

//////////////////////////////
// 📊 COMPTEUR GLOBAL
//////////////////////////////

function getTotalVotes() {
  return new Promise((resolve) => {
    db.get(
      "SELECT COUNT(*) as count FROM votes",
      [],
      (err, row) => {
        if (err || !row) return resolve(0);
        resolve(row.count);
      }
    );
  });
}

//////////////////////////////
// 🚀 START BOT PRINCIPAL
//////////////////////////////

bot.start(async (ctx) => {
  saveUser(ctx);

  await ctx.replyWithPhoto(
    { source: './logo.png' },
    {
      caption: `👋 Bienvenue sur BOOSKABOT

Cliquez sur les boutons du dessous pour naviguer !`,

      reply_markup: {
        inline_keyboard: [
          [{ text: "🗳️ VOTES", callback_data: "votes" }],
          [{
            text: "📱 MINI APP",
            web_app: {
              url: BOT_URL
            }
          }],
          [{ text: "🌐 NOS RÉSEAUX", callback_data: "reseaux" }]
        ]
      }
    }
  );
});

//////////////////////////////
// 🗳️ VOTES
//////////////////////////////

bot.action("votes", async (ctx) => {
  saveUser(ctx);
  await ctx.answerCbQuery();

  const total = await getTotalVotes();

  await ctx.editMessageCaption(
`🗳️ VOTES

🔥 Total de votes : ${total}`,
{
    reply_markup: {
      inline_keyboard: [
        [{ text: "🗳️ VOTER", callback_data: "vote" }],
        [{ text: "⬅️ RETOUR", callback_data: "retour_menu" }]
      ]
    }
  });
});

//////////////////////////////
// 🗳️ VOTER
//////////////////////////////

bot.action("vote", async (ctx) => {
  saveUser(ctx);

  const userId = ctx.from.id;

  db.get(
    "SELECT * FROM votes WHERE user_id = ?",
    [userId],
    (err, row) => {
      if (err) return ctx.answerCbQuery("❌ Erreur serveur");

      if (row) {
        return ctx.answerCbQuery("❌ Tu as déjà voté !");
      }

      db.run("INSERT INTO votes(user_id) VALUES(?)", [userId]);

      ctx.answerCbQuery("✅ Vote enregistré !");
    }
  );
});

//////////////////////////////
// 🌐 RÉSEAUX
//////////////////////////////

bot.action("reseaux", async (ctx) => {
  saveUser(ctx);
  await ctx.answerCbQuery();

  await ctx.editMessageCaption(
`🌐 NOS RÉSEAUX

Choisissez une plateforme :`,
{
    reply_markup: {
      inline_keyboard: [
        [{ text: "🟣 LUFFA", url: "https://callup.luffa.im/c/Rh8K8YR2TNu" }],
        [{ text: "📸 INSTAGRAM", url: "https://instagram.com/booskaplugofficiel" }],
        [{ text: "🥔 POTATO", url: "https://tato.im/booskaplug1" }],
        [{ text: "⬅️ RETOUR", callback_data: "retour_menu" }]
      ]
    }
  });
});

//////////////////////////////
// 🔙 RETOUR
//////////////////////////////

bot.action("retour_menu", async (ctx) => {
  saveUser(ctx);
  await ctx.answerCbQuery();

  await ctx.editMessageCaption(
`👋 Bienvenue sur BOOSKABOT

Cliquez sur les boutons du dessous pour naviguer !`,
{
    reply_markup: {
      inline_keyboard: [
        [{ text: "🗳️ VOTES", callback_data: "votes" }],
        [{
          text: "📱 MINI APP",
          web_app: {
            url: BOT_URL
          }
        }],
        [{ text: "🌐 NOS RÉSEAUX", callback_data: "reseaux" }]
      ]
    }
  });
});

//////////////////////////////
// 🛠️ ADMIN
//////////////////////////////

const ADMIN_IDS = (process.env.ADMIN_IDS || "6832036781")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean);

const adminSessions = {};

function isAdmin(ctx) {
  return ctx.from && ADMIN_IDS.includes(String(ctx.from.id));
}

function adminPanelKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "➕ Ajouter un plug", callback_data: "admin_add_plug" }],
      [{ text: "✏️ Modifier un plug", callback_data: "admin_edit_plug" }],
      [{ text: "📋 Liste des plugs", callback_data: "admin_list_plugs" }],
      [{ text: "🗑️ Supprimer un plug", callback_data: "admin_delete_plug" }]
    ]
  };
}

function startAddPlugSession(userId) {
  adminSessions[userId] = {
    mode: "add",
    step: "name",
    plug: {}
  };
}

function startEditPlugSession(userId) {
  adminSessions[userId] = {
    mode: "edit_select_id",
    step: "edit_id"
  };
}

bot.command("admin", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) {
    return ctx.reply(`❌ Accès refusé.\nTon ID Telegram : ${ctx.from.id}`);
  }

  await ctx.reply("🛠️ Panel Admin BOOSKABOT", {
    reply_markup: adminPanelKeyboard()
  });
});

//////////////////////////////
// 💾 BACKUP ADMIN
//////////////////////////////

bot.command("backup", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) {
    return ctx.reply("❌ Accès refusé.");
  }

  try {
    const dataFile = "/data/data.json";

    if (!fs.existsSync(dataFile)) {
      return ctx.reply("❌ Le fichier /data/data.json est introuvable.");
    }

    db.makeBackup("manual");

    await ctx.replyWithDocument({
      source: fs.createReadStream(dataFile),
      filename: `BSP-backup-${Date.now()}.json`
    });

    await ctx.reply("✅ Sauvegarde envoyée avec succès.");
  } catch (err) {
    console.error("Erreur /backup :", err);
    await ctx.reply(`❌ Erreur backup : ${err.message}`);
  }
});

//////////////////////////////
// 👥 USERS ADMIN
//////////////////////////////

bot.command("users", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) {
    return ctx.reply("❌ Accès refusé.");
  }

  const data = db.readData();
  const users = data.users || [];

  if (!users.length) {
    return ctx.reply("👥 Aucun utilisateur enregistré pour le moment.");
  }

  const list = users.map((u, i) => {
    return `${i + 1}. ${u.first_name || "-"} ${u.last_name || ""}
@${u.username || "sans_username"}
🆔 ${u.id}
🕒 Dernière activité : ${u.last_seen_at || "-"}`;
  }).join("\n\n");

  const message = `👥 Utilisateurs enregistrés : ${users.length}\n\n${list}`;

  if (message.length > 3500) {
    const dataFile = "/data/data.json";

    return ctx.replyWithDocument({
      source: fs.createReadStream(dataFile),
      filename: `BSP-users-${Date.now()}.json`
    });
  }

  await ctx.reply(message);
});

bot.action("admin_list_plugs", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return ctx.answerCbQuery("❌ Accès refusé");

  const plugs = db.getPlugs();

  if (!plugs.length) {
    await ctx.answerCbQuery();
    return ctx.reply("📋 Aucun plug enregistré pour le moment.");
  }

  const list = plugs.map((p, i) => {
    return `${i + 1}. ${p.name}
📍 Ville : ${p.city || "-"}
📌 Secteur : ${p.sector || "-"}
📝 Description : ${p.description || "-"}
🔗 Telegram : ${p.telegram || p.link || "-"}
📸 Instagram : ${p.instagram || "-"}
🥔 Potato : ${p.potato || "-"}
🟣 Luffa : ${p.luffa || "-"}
🗳️ Votes : ${p.votes || 0}
🖼️ ${p.image ? "Image enregistrée" : "Aucune image"}
🆔 ${p.id}`;
  }).join("\n\n");

  await ctx.answerCbQuery();
  await ctx.reply(`📋 Liste des plugs :\n\n${list}`);
});

bot.action("admin_add_plug", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return ctx.answerCbQuery("❌ Accès refusé");

  await ctx.answerCbQuery();

  startAddPlugSession(ctx.from.id);

  await ctx.reply(
`➕ Ajout d'un plug

Étape 1/8 : envoie le NOM du plug.

Pour annuler : /cancel`
  );
});

bot.action("admin_edit_plug", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return ctx.answerCbQuery("❌ Accès refusé");

  await ctx.answerCbQuery();

  const plugs = db.getPlugs();

  if (!plugs.length) {
    return ctx.reply("📋 Aucun plug à modifier.");
  }

  const list = plugs.map((p, i) => {
    return `${i + 1}. ${p.name} — ID: ${p.id}`;
  }).join("\n");

  startEditPlugSession(ctx.from.id);

  await ctx.reply(
`✏️ Quel plug veux-tu modifier ?

${list}

Envoie l'ID du plug.`
  );
});

bot.action("admin_delete_plug", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return ctx.answerCbQuery("❌ Accès refusé");

  await ctx.answerCbQuery();

  const plugs = db.getPlugs();

  if (!plugs.length) {
    return ctx.reply("📋 Aucun plug à supprimer.");
  }

  const list = plugs.map((p, i) => {
    return `${i + 1}. ${p.name} — ID: ${p.id}`;
  }).join("\n");

  await ctx.reply(
`🗑️ Pour supprimer un plug :

${list}

/delplug ID`
  );
});

bot.command("delplug", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return ctx.reply("❌ Accès refusé");

  const id = ctx.message.text.replace("/delplug", "").trim();

  if (!id) return ctx.reply("❌ Mets l'ID du plug.");

  db.deletePlug(id);

  await ctx.reply(`🗑️ Plug supprimé : ${id}`);
});

bot.command("cancel", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return;

  delete adminSessions[ctx.from.id];
  await ctx.reply("❌ Action annulée.");
});bot.action(/^edit_field_(.+)$/, async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return ctx.answerCbQuery("❌ Accès refusé");

  const field = ctx.match[1];
  const session = adminSessions[ctx.from.id];

  if (!session || session.mode !== "edit") {
    await ctx.answerCbQuery();
    return ctx.reply("❌ Aucune modification en cours. Retourne dans /admin.");
  }

  session.field = field;
  session.step = field === "image" ? "edit_photo" : "edit_value";

  await ctx.answerCbQuery();

  const labels = {
    name: "nom",
    city: "ville",
    sector: "secteur",
    description: "description",
    telegram: "lien Telegram",
    instagram: "lien Instagram",
    potato: "lien Potato",
    luffa: "lien Luffa",
    image: "photo"
  };

  if (field === "image") {
    return ctx.reply("🖼️ Envoie la nouvelle photo du plug.");
  }

  return ctx.reply(`✏️ Envoie la nouvelle valeur pour : ${labels[field] || field}`);
});

bot.on("text", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return;

  const session = adminSessions[ctx.from.id];
  if (!session) return;

  const text = ctx.message.text.trim();

  if (text.startsWith("/") && text !== "/cancel") return;

  if (session.mode === "add") {
    if (session.step === "name") {
      session.plug.name = text;
      session.step = "city";
      return ctx.reply("Étape 2/8 : envoie la VILLE du plug.");
    }

    if (session.step === "city") {
      session.plug.city = text;
      session.step = "sector";
      return ctx.reply("Étape 3/8 : envoie le SECTEUR du plug.");
    }

    if (session.step === "sector") {
      session.plug.sector = text;
      session.step = "description";
      return ctx.reply("Étape 4/8 : envoie la DESCRIPTION du plug.");
    }

    if (session.step === "description") {
      session.plug.description = text;
      session.step = "telegram";
      return ctx.reply("Étape 5/8 : envoie le lien TELEGRAM / canal principal.");
    }

    if (session.step === "telegram") {
      session.plug.telegram = text;
      session.plug.link = text;
      session.step = "instagram";
      return ctx.reply("Étape 6/8 : envoie le lien INSTAGRAM, ou écris `non`.");
    }

    if (session.step === "instagram") {
      session.plug.instagram = text.toLowerCase() === "non" ? "" : text;
      session.step = "potato";
      return ctx.reply("Étape 7/8 : envoie le lien POTATO, ou écris `non`.");
    }

    if (session.step === "potato") {
      session.plug.potato = text.toLowerCase() === "non" ? "" : text;
      session.step = "luffa";
      return ctx.reply("Étape 8/8 : envoie le lien LUFFA, ou écris `non`.");
    }

    if (session.step === "luffa") {
      session.plug.luffa = text.toLowerCase() === "non" ? "" : text;
      session.step = "photo";
      return ctx.reply("🖼️ Dernière étape : envoie maintenant la PHOTO du plug.");
    }
  }

  if (session.mode === "edit_select_id" && session.step === "edit_id") {
    const plug = db.getPlugs().find(p => String(p.id) === String(text));

    if (!plug) {
      return ctx.reply("❌ ID introuvable. Réessaie ou fais /cancel.");
    }

    adminSessions[ctx.from.id] = {
      mode: "edit",
      step: "choose_field",
      plugId: plug.id
    };

    return ctx.reply(`✏️ Modification de : ${plug.name}

Choisis ce que tu veux modifier :`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📝 Nom", callback_data: "edit_field_name" }],
          [{ text: "📍 Ville", callback_data: "edit_field_city" }],
          [{ text: "📌 Secteur", callback_data: "edit_field_sector" }],
          [{ text: "📖 Description", callback_data: "edit_field_description" }],
          [{ text: "🔗 Telegram", callback_data: "edit_field_telegram" }],
          [{ text: "📸 Instagram", callback_data: "edit_field_instagram" }],
          [{ text: "🥔 Potato", callback_data: "edit_field_potato" }],
          [{ text: "🟣 Luffa", callback_data: "edit_field_luffa" }],
          [{ text: "🖼️ Photo", callback_data: "edit_field_image" }]
        ]
      }
    });
  }

  if (session.mode === "edit" && session.step === "edit_value") {
    const value = text.toLowerCase() === "non" ? "" : text;
    const updates = { [session.field]: value };

    if (session.field === "telegram") {
      updates.link = value;
    }

    const plug = db.updatePlug(session.plugId, updates);

    delete adminSessions[ctx.from.id];

    if (!plug) return ctx.reply("❌ Plug introuvable.");

    return ctx.reply(`✅ Plug modifié avec succès : ${plug.name}`);
  }
});bot.on("photo", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return;

  const session = adminSessions[ctx.from.id];
  if (!session) return;

  const photos = ctx.message.photo;
  const bestPhoto = photos[photos.length - 1];
  const fileLink = await ctx.telegram.getFileLink(bestPhoto.file_id);

  if (session.mode === "add" && session.step === "photo") {
    const plug = db.addPlug({
      name: session.plug.name,
      city: session.plug.city,
      sector: session.plug.sector,
      description: session.plug.description,
      telegram: session.plug.telegram,
      link: session.plug.link || session.plug.telegram,
      instagram: session.plug.instagram,
      potato: session.plug.potato,
      luffa: session.plug.luffa,
      image: fileLink.href
    });

    delete adminSessions[ctx.from.id];

    return ctx.reply(
`✅ Plug ajouté avec succès !

📌 Nom : ${plug.name}
📍 Ville : ${plug.city}
📌 Secteur : ${plug.sector}
📝 Description : ${plug.description}
🔗 Telegram : ${plug.telegram || "-"}
📸 Instagram : ${plug.instagram || "-"}
🥔 Potato : ${plug.potato || "-"}
🟣 Luffa : ${plug.luffa || "-"}
🖼️ Image enregistrée
🆔 ID : ${plug.id}`
    );
  }

  if (session.mode === "edit" && session.step === "edit_photo") {
    const plug = db.updatePlug(session.plugId, {
      image: fileLink.href
    });

    delete adminSessions[ctx.from.id];

    if (!plug) return ctx.reply("❌ Plug introuvable.");

    return ctx.reply(`✅ Photo modifiée pour : ${plug.name}`);
  }
});

//////////////////////////////
// 🚪 BOT PASSERELLE PUBLIC
//////////////////////////////

if (accessBot) {
  accessBot.start(async (ctx) => {
    if (!MAIN_BOT_USERNAME) {
      return ctx.reply("❌ Bot principal non configuré.");
    }

    await ctx.reply(
`🔌 Bienvenue sur BSP

Clique sur le bouton ci-dessous pour accéder à la plateforme officielle.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🚀 Accéder à BSP",
                url: "https://booskabot.vercel.app/access.html"
              }
            ]
          ]
        }
      }
    );
  });
}

//////////////////////////////
// 🌍 SERVEUR HTTP POUR RENDER + API
//////////////////////////////

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.url === "/plugs") {
    const plugs = db.getPlugs().sort((a, b) => (b.votes || 0) - (a.votes || 0));

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(plugs));
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("BOOSKABOT est en ligne 🚀");
}).listen(PORT, () => {
  console.log(`Serveur HTTP lancé sur le port ${PORT}`);
});

//////////////////////////////
// 🚀 LAUNCH
//////////////////////////////

const launches = [bot.launch()];

if (accessBot) {
  launches.push(accessBot.launch());
}

Promise.all(launches)
  .then(() => {
    console.log("Bot principal prêt 🚀");

    if (accessBot) {
      console.log("Bot passerelle prêt 🚪");
    }
  })
  .catch((err) => {
    console.error("Erreur lancement bot :", err.message);

    if (err.message && err.message.includes("409")) {
      console.log("Conflit Telegram 409 détecté : une autre instance tourne encore.");
      console.log("Le serveur HTTP reste actif, Render ne crash pas.");
    } else {
      throw err;
    }
  });

process.once("SIGINT", () => {
  bot.stop("SIGINT");
  if (accessBot) accessBot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  if (accessBot) accessBot.stop("SIGTERM");
});