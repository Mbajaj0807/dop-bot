const TelegramBot = require("node-telegram-bot-api");
const state = require("./state");
const Session = require("./sessionStore");
const { loginERP, fetchStudentProgress } = require("./erp");
const { generateOutPass } = require("./automation");
const { fetchMessMenu } = require("./messMenu");
const { fetchMessQR } = require("./fetchMessQR");
const QRCode = require("qrcode");
const { fetchAttendance } = require("./fetchAttendance");
const { calculateAttendanceImpact } = require("./attendanceCalc");
const { fetchDetailedAttendance } = require("./fetchDetailedAttendance");
const { formatSubject } = require("./formatSubjectAttendance");



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
      console.log("✅ ERP Login successful for:", session.studentId);
    const progress = await fetchStudentProgress(
      session.studentId,
      session.cookie
    );

   console.log("Saving progress data:", {
  prId: progress.PrID,
  crId: progress.CrID,
  deptId: progress.DeptID,
  semId: progress.SemID,
  acYr: progress.AcYr,
  cmProgId: progress.CmProgID
});


    // 👉 SAVE SESSION
    await Session.findOneAndUpdate(
      { telegramUserId: userId },
      {
        telegramUserId: userId,
        cookie: session.cookie,
        studentId: session.studentId,
        studentName: session.studentName,
        parentId: session.parentId,
        instituteId: session.instituteId,
        prId: progress.PrID,
        crId: progress.CrID,
        deptId: progress.DeptID,
        semId: progress.SemID,
        acYr: progress.AcYr,
        cmProgId: progress.CmProgID,
        lastUsedAt: new Date()
      },
      { upsert: true }
    );

    state.clear(userId);

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

  if (text === "/mess-menu" || text === "/messmenu") {
  const session = await Session.findOne({ telegramUserId: userId });

  if (!session) {
    return bot.sendMessage(chatId, "❌ Please /login first");
  }

  try {
    const menu = await fetchMessMenu(session);

    console.log("📤 Parsed menu object:");
    console.dir(menu, { depth: null });

    if (menu.error) {
      return bot.sendMessage(chatId, "❌ Mess menu not available");
    }

    let msg = `🍽️ *Mess Menu – ${menu.date}*\n`;
    msg += `📍 *${menu.facility}*\n\n`;

    for (const meal of menu.meals) {
      msg += `*${meal.msCde || meal.meal || "Meal"}*\n`;

      let items = [];

if (typeof meal.msNme === "string") {
  items = meal.msNme
    .split("\n")
    .map(i => i.trim())
    .filter(Boolean);
} else if (Array.isArray(meal.oItems)) {
  items = meal.oItems;
} else if (Array.isArray(meal.foodItems)) {
  items = meal.foodItems;
}


      if (items.length === 0) {
  msg += `_No items listed_\n\n`;
  continue;
}

for (const item of items) {
  msg += `• ${item}\n`;
}
msg += `\n`;

    }

    return bot.sendMessage(chatId, msg, {
      parse_mode: "Markdown"
    });

  } catch (err) {
    console.error("❌ /mess-menu handler crashed");
    console.error(err);
    return bot.sendMessage(chatId, "❌ Failed to fetch mess menu");
  }
}


if (text === "/showmessqr") {
  const session = await Session.findOne({ telegramUserId: userId });
  if (!session) {
    return bot.sendMessage(chatId, "❌ Please /login first");
  }

  try {
    const qrData = await fetchMessQR(session);

    if (qrData.error || !qrData.prQrCd) {
      return bot.sendMessage(chatId, "❌ Mess QR not available");
    }

    // 🔑 CAMU returns RAW QR PAYLOAD, not image
    const qrBuffer = await QRCode.toBuffer(qrData.prQrCd, {
      type: "png",
      width: 320,
      margin: 2
    });

    return bot.sendPhoto(chatId, qrBuffer, {
      caption: "🍽️ *Mess QR Code*\nShow this at the mess counter",
      parse_mode: "Markdown"
    });

  } catch (err) {
    console.error(err);
    return bot.sendMessage(chatId, "❌ Failed to generate mess QR");
  }
}



if (text === "/attendance") {
  const session = await Session.findOne({ telegramUserId: userId });
  if (!session) {
    return bot.sendMessage(chatId, "❌ Please /login first");
  }

  try {
    const att = await fetchAttendance(session);

    if (att.error) {
      return bot.sendMessage(chatId, "❌ Attendance data not available");
    }

    const result = calculateAttendanceImpact(
      att.present,
      att.total
    );

    let msg = `📊 *Overall Attendance*\n\n`;
    msg += `📈 Percentage: *${result.currentPercent}%*\n`;
    msg += `📚 Classes: *${att.present}/${att.total}*\n\n`;

    if (result.status === "LOW") {
      msg += `⚠️ Attendance below 75%\n`;
      msg += `👉 Attend next *${result.classesToAttend}* classes continuously to reach 75%`;
    } else {
      msg += `✅ Attendance safe (≥ 75%)\n`;
      msg += `😌 You can miss *${result.classesCanMiss}* classes and stay above 75%`;
    }

    return bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });

  } catch (err) {
    return bot.sendMessage(chatId, "❌ Failed to fetch attendance");
  }
}



if (text === "/detailattendance") {
  const session = await Session.findOne({ telegramUserId: userId });
  if (!session) {
    return bot.sendMessage(chatId, "❌ Please /login first");
  }

  try {
    const subjects = await fetchDetailedAttendance(session);

    if (subjects.error) {
      return bot.sendMessage(chatId, "❌ Attendance details not available");
    }

    let msg = `📊 *Detailed Attendance (Per Subject)*\n\n`;

    for (const subj of subjects) {
      msg += formatSubject(subj) + "\n";
    }

    return bot.sendMessage(chatId, msg, {
      parse_mode: "Markdown"
    });

  } catch (err) {
    return bot.sendMessage(chatId, "❌ Failed to fetch detailed attendance");
  }
}






});



