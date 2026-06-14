require('dotenv').config();

const { Telegraf } = require('telegraf');
const db = require('./database');
const http = require("http");
const fs = require("fs");

const BOT_URL = "https://booskabot.vercel.app";
const CANAL_URL = "https://booskabot.vercel.app/canal.html";

const bot = new Telegraf(process.env.BOT_TOKEN);

const accessBot = process.env.ACCESS_BOT_TOKEN
  ? new Telegraf(process.env.ACCESS_BOT_TOKEN)
  : null;

const MAIN_BOT_USERNAME = process.env.MAIN_BOT_USERNAME || "booskaplugbot";

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

async function safeAnswer(ctx, text) {
  try {
    await ctx.answerCbQuery(text);
  } catch (e) {}
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
// 🗳️ VOTES PAR PLUG
//////////////////////////////

function plugProfileText(plug) {
  return `🔌 ${plug.name}

📍 Ville : ${plug.city || "-"}
📌 Secteur : ${plug.sector || "-"}
🗳️ Votes : ${plug.votes || 0}

📝 ${plug.description || "Aucune description."}`;
}

function isValidUrl(value) {
  return typeof value === "string" &&
    (value.startsWith("http://") || value.startsWith("https://"));
}

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🗳️ VOTES", callback_data: "votes" }],
      [{
        text: "📱 MINI APP",
        web_app: {
          url: BOT_URL
        }
      }],
      [{
        text: "🔐 TELEGRAM",
        web_app: {
          url: CANAL_URL
        }
      }],
      [{ text: "🌐 NOS RÉSEAUX", callback_data: "reseaux" }]
    ]
  };
}

function plugProfileKeyboard(plug) {
  const buttons = [
    [{ text: `🗳️ Voter pour ${plug.name}`, callback_data: `vote_plug_${plug.id}` }]
  ];

  buttons.push([
    {
      text: "🔗 Lien pour voter",
      url: `https://t.me/BSPStartBot?start=plug_${plug.id}`
    }
  ]);

  if (isValidUrl(plug.telegram || plug.link)) {
    buttons.push([{ text: "🔗 Telegram", url: plug.telegram || plug.link }]);
  }

  if (isValidUrl(plug.instagram)) {
    buttons.push([{ text: "📸 Instagram", url: plug.instagram }]);
  }

  if (isValidUrl(plug.potato)) {
    buttons.push([{ text: "🥔 Potato", url: plug.potato }]);
  }

  if (isValidUrl(plug.luffa)) {
    buttons.push([{ text: "🟣 Luffa", url: plug.luffa }]);
  }

  buttons.push([{ text: "⬅️ Retour aux votes", callback_data: "votes" }]);

  return { inline_keyboard: buttons };
}

//////////////////////////////
// 🚀 START BOT PRINCIPAL
//////////////////////////////

bot.start(async (ctx) => {
  saveUser(ctx);

  const payload = ctx.startPayload || "";

  if (payload.startsWith("plug_")) {
    const plugId = payload.replace("plug_", "");
    const plug = db.getPlugs().find(p => String(p.id) === String(plugId));

    if (!plug) {
      return ctx.reply("❌ Plug introuvable.");
    }

    return ctx.replyWithPhoto(
      { source: "./logo.png" },
      {
        caption: plugProfileText(plug),
        reply_markup: plugProfileKeyboard(plug)
      }
    );
  }

  await ctx.replyWithPhoto(
    { source: './logo.png' },
    {
      caption: `👋 Bienvenue sur BOOSKABOT

Cliquez sur les boutons du dessous pour naviguer !`,
      reply_markup: mainMenuKeyboard()
    }
  );
});

bot.action("votes", async (ctx) => {
  saveUser(ctx);
  await safeAnswer(ctx);

  const plugs = db.getPlugs();

  if (!plugs.length) {
    return ctx.editMessageCaption(
`🗳️ VOTES

Aucun plug disponible pour le moment.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ RETOUR", callback_data: "retour_menu" }]
          ]
        }
      }
    );
  }

  const keyboard = plugs.map((plug, index) => {
    return [{
      text: `#${index + 1} 🗳️ ${plug.name} — ${plug.votes || 0} vote${(plug.votes || 0) > 1 ? "s" : ""}`,
      callback_data: `plug_profile_${plug.id}`
    }];
  });

  keyboard.push([{ text: "⬅️ RETOUR", callback_data: "retour_menu" }]);

  await ctx.editMessageCaption(
`🗳️ VOTES DES PLVGS

Choisis un 🔌 pour voir son profil ou voter :`,
    {
      reply_markup: {
        inline_keyboard: keyboard
      }
    }
  );
});bot.action(/^plug_profile_(.+)$/, async (ctx) => {
  saveUser(ctx);
  await safeAnswer(ctx);

  const plugId = ctx.match[1];
  const plug = db.getPlugs().find(p => String(p.id) === String(plugId));

  if (!plug) {
    return ctx.reply("❌ Plug introuvable.");
  }

  await ctx.editMessageCaption(
    plugProfileText(plug),
    {
      reply_markup: plugProfileKeyboard(plug)
    }
  );
});

bot.action(/^vote_plug_(.+)$/, async (ctx) => {
  saveUser(ctx);

  const plugId = ctx.match[1];
  const userId = ctx.from.id;

  const result = db.votePlug(userId, plugId);

  if (!result.ok && result.reason === "already_voted") {
    return safeAnswer(ctx, "❌ Tu as déjà voté pour ce plug !");
  }

  if (!result.ok) {
    return safeAnswer(ctx, "❌ Plug introuvable.");
  }

  await safeAnswer(ctx, "✅ Vote enregistré !");

  const plug = db.getPlugs().find(p => String(p.id) === String(plugId));

  await ctx.editMessageCaption(
    plugProfileText(plug),
    {
      reply_markup: plugProfileKeyboard(plug)
    }
  );
});

//////////////////////////////
// 🌐 RÉSEAUX
//////////////////////////////

bot.action("reseaux", async (ctx) => {
  saveUser(ctx);
  await safeAnswer(ctx);

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
  await safeAnswer(ctx);

  await ctx.editMessageCaption(
`👋 Bienvenue sur BOOSKABOT

Cliquez sur les boutons du dessous pour naviguer !`,
{
    reply_markup: mainMenuKeyboard()
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
}bot.command("admin", async (ctx) => {
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

  if (!isAdmin(ctx)) return safeAnswer(ctx, "❌ Accès refusé");

  const plugs = db.getPlugs();

  if (!plugs.length) {
    await safeAnswer(ctx);
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

  await safeAnswer(ctx);
  await ctx.reply(`📋 Liste des plugs :\n\n${list}`);
});bot.action("admin_add_plug", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return safeAnswer(ctx, "❌ Accès refusé");

  await safeAnswer(ctx);

  startAddPlugSession(ctx.from.id);

  await ctx.reply(
`➕ Ajout d'un plug

Étape 1/8 : envoie le NOM du plug.

Pour annuler : /cancel`
  );
});

bot.action("admin_edit_plug", async (ctx) => {
  saveUser(ctx);

  if (!isAdmin(ctx)) return safeAnswer(ctx, "❌ Accès refusé");

  await safeAnswer(ctx);

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

  if (!isAdmin(ctx)) return safeAnswer(ctx, "❌ Accès refusé");

  await safeAnswer(ctx);

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

  if (!isAdmin(ctx)) return safeAnswer(ctx, "❌ Accès refusé");

  const field = ctx.match[1];
  const session = adminSessions[ctx.from.id];

  if (!session || session.mode !== "edit") {
    await safeAnswer(ctx);
    return ctx.reply("❌ Aucune modification en cours. Retourne dans /admin.");
  }

  session.field = field;
  session.step = field === "image" ? "edit_photo" : "edit_value";

  await safeAnswer(ctx);

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
    }    if (session.step === "potato") {
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
    const payload = ctx.startPayload || "";

    let miniAppUrl = "https://booskabot.vercel.app/access.html";

    if (payload.startsWith("plug_")) {
      const plugId = payload.replace("plug_", "");
      miniAppUrl = `https://booskabot.vercel.app/access.html?plug=${plugId}`;
    }

    await ctx.reply(
      `🔌 Accès BSP prêt.

Clique sur le bouton ci-dessous pour continuer.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🚀 Accéder à BSP",
                web_app: {
                  url: miniAppUrl
                }
              }
            ]
          ]
        }
      }
    );
  });
}//////////////////////////////
// 🌍 SERVEUR HTTP POUR RENDER + API
//////////////////////////////

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/plugs") {
    const plugs = db.getPlugs().sort((a, b) => (b.votes || 0) - (a.votes || 0));

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(plugs));
  }

  if (url.pathname === "/check-user") {
    const id = url.searchParams.get("id");
    const data = db.readData();
    const users = data.users || [];

    const exists = users.some(u => String(u.id) === String(id));

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ exists }));
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