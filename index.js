require('dotenv').config();

const { Telegraf } = require('telegraf');
const db = require('./database');
const http = require("http");

const BOT_URL = "https://booskabot.vercel.app";

const bot = new Telegraf(process.env.BOT_TOKEN);

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
// 🚀 START
//////////////////////////////

bot.start(async (ctx) => {
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
  const userId = ctx.from.id;

  db.get(
    "SELECT * FROM votes WHERE user_id = ?",
    [userId],
    (err, row) => {

      if (err) return ctx.answerCbQuery("❌ Erreur serveur");

      if (row) {
        return ctx.answerCbQuery("❌ Tu as déjà voté !");
      }

      db.run(
        "INSERT INTO votes(user_id) VALUES(?)",
        [userId]
      );

      ctx.answerCbQuery("✅ Vote enregistré !");
    }
  );
});

//////////////////////////////
// 🌐 RÉSEAUX
//////////////////////////////

bot.action("reseaux", async (ctx) => {
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

const ADMIN_IDS = ["6832036781"];

function isAdmin(ctx) {
  return ADMIN_IDS.includes(String(ctx.from.id));
}

bot.command("admin", async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply(`❌ Accès refusé.\nTon ID Telegram : ${ctx.from.id}`);
  }

  await ctx.reply("🛠️ Panel Admin BOOSKABOT", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Ajouter un plug", callback_data: "admin_add_plug" }],
        [{ text: "📋 Liste des plugs", callback_data: "admin_list_plugs" }],
        [{ text: "🗑️ Supprimer un plug", callback_data: "admin_delete_plug" }]
      ]
    }
  });
});

bot.action("admin_list_plugs", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("❌ Accès refusé");

  const plugs = db.getPlugs();

  if (!plugs.length) {
    await ctx.answerCbQuery();
    return ctx.reply("📋 Aucun plug enregistré pour le moment.");
  }

  const list = plugs.map((p, i) => {
    return `${i + 1}. ${p.name}
📍 ${p.city}
🔗 ${p.link || "Aucun lien"}
🖼️ ${p.image || "Aucune image"}
🆔 ${p.id}`;
  }).join("\n\n");

  await ctx.answerCbQuery();
  await ctx.reply(`📋 Liste des plugs :\n\n${list}`);
});

bot.action("admin_add_plug", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("❌ Accès refusé");

  await ctx.answerCbQuery();
  await ctx.reply(
`➕ Pour ajouter un plug, envoie un message comme ça :

/addplug Nom du plug | Ville | Lien | ImageURL

Exemple :
/addplug Farmz 87/47 | Paris | https://exemple.com | https://image.com/photo.jpg`
  );
});

bot.command("addplug", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ Accès refusé");

  const text = ctx.message.text.replace("/addplug", "").trim();
  const parts = text.split("|").map(p => p.trim());

  if (parts.length < 2) {
    return ctx.reply("❌ Format incorrect.\n\nExemple :\n/addplug Nom | Ville | Lien | ImageURL");
  }

  const plug = db.addPlug({
    name: parts[0],
    city: parts[1],
    link: parts[2] || "",
    image: parts[3] || ""
  });

  await ctx.reply(`✅ Plug ajouté : ${plug.name}\n🆔 ID : ${plug.id}`);
});

bot.action("admin_delete_plug", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("❌ Accès refusé");

  await ctx.answerCbQuery();
  await ctx.reply(
`🗑️ Pour supprimer un plug :

/delplug ID

Exemple :
/delplug 1718200000000`
  );
});

bot.command("delplug", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ Accès refusé");

  const id = ctx.message.text.replace("/delplug", "").trim();

  if (!id) return ctx.reply("❌ Mets l'ID du plug.");

  db.deletePlug(id);

  await ctx.reply(`🗑️ Plug supprimé : ${id}`);
});

//////////////////////////////
// 🌍 SERVEUR HTTP POUR RENDER
//////////////////////////////

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("BOOSKABOT est en ligne 🚀");
}).listen(PORT, () => {
  console.log(`Serveur HTTP lancé sur le port ${PORT}`);
});

//////////////////////////////
// 🚀 LAUNCH
//////////////////////////////

bot.launch()
  .then(() => {
    console.log("Bot prêt 🚀");
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