const TelegramBot = require("node-telegram-bot-api");
const state = require("./state");
const Session = require("./sessionStore");
const { loginERP } = require("./erp");
const { generateOutPass } = require("./automation");

const bot = new TelegramBot("8578047453:AAHsIxleJfQLjpRw1T5IrJw_ESGzq7UmzBE", { polling: true });



bot.on("message", async msg => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = msg.text?.trim();

  const s = state.get(userId);
  if (text === "/start") {
  return bot.sendMessage(
    chatId,
`👋 Welcome!

This bot helps you quickly generate a *Day Out Pass* on Bennett ERP.

📌 What you can do:
• Create a Day Out Pass for *now + 1 minute till 7:00 PM*
• Get it *approved automatically*
• Do everything with a single command

📍 Commands:
/login – Connect your account(parent camu credentials)
/generateoutpass – Create out-pass
/status – Check connection
/logout – Disconnect account

🚀 Start with /login`
  );
}

  try {
    /* LOGIN FLOW */
    if (text === "/login") {
      state.set(userId, { step: "WAIT_EMAIL" });
      return bot.sendMessage(chatId, "📧 Enter ERP email:");
    }

    if (s?.step === "WAIT_EMAIL") {
      state.set(userId, { step: "WAIT_PASSWORD", tempEmail: text });
      return bot.sendMessage(chatId, "🔑 Enter ERP password:");
    }

    if (s?.step === "WAIT_PASSWORD") {
      bot.sendMessage(chatId, "⏳ Logging in...");
      const session = await loginERP(s.tempEmail, text);

      await Session.findOneAndUpdate(
        { telegramUserId: userId },
        { ...session, telegramUserId: userId, lastUsedAt: new Date() },
        { upsert: true }
      );

      state.clear(userId);
      return bot.sendMessage(
        chatId,
        `✅ Login successful\n👤 ${session.studentName}`
      );
    }

    /* GENERATE OUT PASS */
    if (text === "/generateoutpass") {
      const session = await Session.findOne({ telegramUserId: userId });
      if (!session)
        return bot.sendMessage(chatId, "❌ Please /login first");

      state.set(userId, { step: "WAIT_REASON" });
      return bot.sendMessage(chatId, "📝 Enter reason for out pass:");
    }

    if (s?.step === "WAIT_REASON") {
      state.clear(userId);
      const session = await Session.findOne({ telegramUserId: userId });

      bot.sendMessage(chatId, "⏳ Generating out pass...");
      const result = await generateOutPass(session, text);

      if (result.error)
        return bot.sendMessage(chatId, `❌ Failed: ${result.error}`);

      return bot.sendMessage(
        chatId,
        `✅ Out Pass Approved\n🕒 ${new Date(
          result.from
        ).toLocaleTimeString()} → ${new Date(
          result.to
        ).toLocaleTimeString()}`
      );
    }
  } catch (err) {
    console.error(err);
    state.clear(userId);
    bot.sendMessage(chatId, "❌ Error occurred. Please try again.");
  }
});
