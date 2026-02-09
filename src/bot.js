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
const {fetchTimetable} = require("./fetchTimtable");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });


bot.on("message", async msg => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = msg.text?.trim();

  const s = state.get(userId);
  if (text === "/start") {
  return bot.sendMessage(
    chatId,
`👋 Welcome!

This bot helps you access Bennett ERP features easily.

Available Commands:
/login – Connect Parent CAMU account
/generateoutpass – Create Day Out Pass
/timetable – View today's timetable
/attendance – Check attendance
/messmenu – View mess menu
/showmessqr – Get mess QR code`

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

    bot.onText(/\/contribute/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🤝 Contribute to this Bot

This project is open-source and welcomes contributions!

💻 GitHub Repository:
https://github.com/Mbajaj0807/campus-erp-bot

📌 How you can help:
• Report issues or bugs
• Add new features or commands
• Improve existing functionality
• Enhance documentation
• Optimize performance

🔁 How to contribute:
1. Fork the repository
2. Create a new branch
3. Make your changes
4. Open a Pull Request

Thank you for helping make this bot even better ❤️`
  );
});


    /* GENERATE OUT PASS */
    if (text === "/generateoutpass") {
  const session = await Session.findOne({ telegramUserId: userId });
  if (!session) {
    return bot.sendMessage(chatId, "❌ Please /login first");
  }

  await bot.sendMessage(chatId, "⏳ Generating out pass...");

  const result = await generateOutPass(session); // reason already hardcoded inside

  if (result.error) {
    return bot.sendMessage(chatId, `❌ Failed: ${result.error}`);
  }

  return bot.sendMessage(
    chatId,
    `✅ *Out Pass Approved*\n🕒 ${new Date(result.from).toLocaleTimeString(
      "en-IN",
      { hour: "2-digit", minute: "2-digit" }
    )} → ${new Date(result.to).toLocaleTimeString(
      "en-IN",
      { hour: "2-digit", minute: "2-digit" }
    )}`,
    { parse_mode: "Markdown" }
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
      } 
      for (const item of items) {
        msg += `• ${item}\n`;
      }
      msg += `\n`;
      if (meal.srvSts === 'P'){
        console.log("Meal Status: ", meal.srvSts);
        msg += `Status: ❌🍛Not Served\n`;
      }
      else if (meal.srvSts === 'C'){
        msg += `Status: ✅🍛Served at ${meal.srvDte || 'N/A'}\n`;
      }
      else{
        msg += `Status: Unknown\n`;
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

    msg+= `\n\nClick /detailattendance to view per-subject attendance details.`;

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

if (text === "/timetable") {
  const session = await Session.findOne({ telegramUserId: userId });

  if (!session) {
    return bot.sendMessage(chatId, "❌ Please /login first");
  }

  const required = ["prId", "crId", "deptId", "semId", "acYr"];
  for (const key of required) {
    if (!session[key]) {
      return bot.sendMessage(
        chatId,
        "❌ Timetable not set up yet. Please /login again."
      );
    }
  }

  try {
    // 1️⃣ Fetch timetable
    const periods = await fetchTimetable(session);

    if (!periods || periods.length === 0) {
      return bot.sendMessage(chatId, "📭 No classes scheduled for today");
    }

    // 2️⃣ Fetch attendance
    const subjects = await fetchDetailedAttendance(session);

    // 3️⃣ Build attendance lookup by SubjId
    const attendanceMap = {};
    for (const s of subjects) {
      attendanceMap[s.SubjId] = {
        percent: s.OvrAllPrcntg,
        present: s.prsentCnt,
        total: s.all
      };
    }

    // 4️⃣ Build message
    let msg = `📅 *Today's Timetable*\n\n`;

    for (const p of periods) {
      const att = attendanceMap[p.subjectId];

      let attendanceLine = "⚪ _Attendance not available_";

      if (att) {
        const emoji =
          att.percent >= 75 ? "🟢" :
          att.percent >= 65 ? "🟡" : "🔴";

        attendanceLine = `${emoji} *Attendance:* ${att.percent}% (${att.present}/${att.total})`;
      }

      msg += `⏰ *${p.start}*\n`;
      msg += `📘 ${p.subject}\n`;
      msg += `🏫 ${p.room}\n`;
      msg += `👨‍🏫 ${p.faculty}\n`;
      msg += `${attendanceLine}\n\n`;
    }

    return bot.sendMessage(chatId, msg, {
      parse_mode: "Markdown"
    });

  } catch (err) {
    console.error("Timetable error:", err);
    return bot.sendMessage(chatId, "❌ Failed to fetch timetable");
  }
}






});



