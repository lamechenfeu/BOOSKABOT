require('dotenv').config();

const { Telegraf } = require('telegraf');
const db = require('./database');

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

          // 📱 MINI APP DIRECT
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
// 🚀 LAUNCH
//////////////////////////////

bot.launch();

console.log("Bot prêt 🚀");
const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("BOOSKABOT est en ligne 🚀");
}).listen(PORT, () => {
  console.log(`Serveur HTTP lancé sur le port ${PORT}`);
});