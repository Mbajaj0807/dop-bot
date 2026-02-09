const axios = require("axios");
const { getOutpassWindow } = require("../utils/time");

const BASE = "https://student.bennetterp.camu.in";
let dop = null;
async function generateOutPass(session, reason) {
  console.log("====================================================");
  console.log("🚀 STARTING OUT PASS AUTOMATION");
  console.log("👤 Student:", session.studentName);
  console.log("🆔 Student ID:", session.studentId);
  console.log("👨‍👩‍👦 Parent ID:", session.parentId);
  console.log("🏫 Institute ID:", session.instituteId);
  console.log("📝 Reason:", reason);
  console.log("====================================================");

  const api = axios.create({
    headers: {
      Cookie: session.cookie,
      "content-type": "application/json",
      appversion: "v2",
      clienttzofst: "330"
    },
    timeout: 20000
  });

  /* =====================================================
     STEP 1: CREATE LEAVE
  ===================================================== */
  let leaveRefId;
  let leaveDate; // ISO string (UTC midnight)

  try {
    console.log("----------------------------------------------------");
    console.log("➡️ STEP 1: CREATING LEAVE");

    // Always create leave for "tommorrow IST"
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leavePayload = {
      PerTy: "Student",
      PerId: session.studentId,
      PerNm: session.studentName,
      InId: session.instituteId,
      HstleReq: "true",
      LvTy: "Leave",

      FrDt: today.toISOString(),
      ToDt: today.toISOString(),

      loggedInId: session.studentId,
      timezoneOffSet: 330,
      rson: "Telegram Auto Leave",
      periods: [],
      atcmnt: []
    };

    console.log("📤 Leave payload:");
    console.dir(leavePayload, { depth: null });

    const leaveRes = await api.post(
      `${BASE}/api/Leave/crtLv`,
      leavePayload
    );

    const leaveData = leaveRes.data.output.data;

    leaveRefId = leaveData.refId;
    leaveDate = leaveData.start; // 🔑 ERP-approved leave date

    console.log("✅ Leave created successfully");
    console.log("🔗 Leave refId:", leaveRefId);
    console.log("📅 Leave date :", leaveDate);

    if (!leaveRefId || !leaveDate) {
      return { error: "LEAVE_DATA_INVALID" };
    }
  } catch (err) {
    console.log("❌ ERROR while creating leave");
    console.log("STATUS:", err.response?.status);
    console.dir(err.response?.data || err.message, { depth: null });
    return { error: "LEAVE_FAILED" };
  }

  /* =====================================================
     STEP 2: CALCULATE TIME WINDOW (ON LEAVE DATE)
  ===================================================== */
  console.log("----------------------------------------------------");
  console.log("⏱ Calculating out-pass window on leave date...");

  const t = getOutpassWindow(leaveDate);

  if (!t) {
    console.log("❌ FAILED: Current time is past 7:00 PM IST");
    return { error: "TOO_LATE" };
  }

  console.log("✅ Time window resolved:");
  console.log("   🕒 Start:", t.frdt);
  console.log("   🕒 End  :", t.todt);

  /* =====================================================
     STEP 3: CREATE DOP
  ===================================================== */
  try {
    console.log("----------------------------------------------------");
    console.log("➡️ STEP 2: CREATING DAY OUT PASS (DOP)");

    const dopPayload = {
      PerTy: "Student",
      PerId: session.studentId,
      PerNm: session.studentName,
      InId: session.instituteId,
      HstleReq: "true",
      LvTy: "Leave",

      GateOutPass: true,
      passTy: "DOP",

      // 🔑 MUST MATCH LEAVE DATE
      FrDt: leaveDate,
      ToDt: leaveDate,

      // 🕒 Time window (same date)
      frdt: t.frdt,
      todt: t.todt,

      refId: leaveRefId,

      Type: "student",
      loggedInId: session.studentId,
      stuId: session.studentId,
      timezoneOffSet: 330,
      rson: reason
    };

    console.log("📤 DOP payload:");
    console.dir(dopPayload, { depth: null });

    const dopRes = await api.post(
      `${BASE}/api/Leave/crtLv`,
      dopPayload
    );

    console.log("✅ DOP creation request sent");
    console.log("📥 DOP response:");
    console.dir(dopRes.data, { depth: null });
  } catch (err) {
    console.log("❌ ERROR while creating DOP");
    console.log("STATUS:", err.response?.status);
    console.dir(err.response?.data || err.message, { depth: null });
    return { error: "DOP_CREATE_FAILED" };
  }

  /* =====================================================
     STEP 4: FETCH & APPROVE DOP
  ===================================================== */
  let dop;
  try {
    console.log("----------------------------------------------------");
    console.log("➡️ STEP 3: FETCHING DOP");

    const listRes = await api.post(
      `${BASE}/api/Leave/getAllleave/`,
      {
        StuID: session.studentId,
        isFrmReact: true
      }
    );

    const allDops = listRes.data.output.data
  .filter(d =>
    d.isGatepass === true &&
    d.passTyCode === "DOP" &&
    d.frdt?.startsWith(leaveDate.slice(0, 10))
  )
  .sort((a, b) => new Date(b.CrAt) - new Date(a.CrAt));

 dop = allDops[0];

    if (!dop || !dop._id) {
      console.log("❌ No SUB DOP found");
      return { error: "DOP_NOT_FOUND" };
    }

    console.log("✅ DOP FOUND:", dop._id);
  } catch (err) {
    console.log("❌ ERROR fetching DOP");
    return { error: "DOP_FETCH_FAILED" };
  }

  try {
    console.log("----------------------------------------------------");
    console.log("➡️ STEP 4: APPROVING DOP");
    
    await api.post(
      `${BASE}/api/gatepasses/change-gatepasses-status`,
      {
        id: dop._id,
        roll: "parent",
        action: "Approve",
        PerId: session.studentId,
        loggedInId: session.parentId
      } 
    );
    

    console.log("✅ DOP APPROVED SUCCESSFULLY");
  } catch (err) {
    console.log("❌ ERROR approving DOP");
    
  console.log("STATUS:", err.response?.status);
  console.log("HEADERS:", err.response?.headers);
  console.log("DATA:");
  console.dir(err.response?.data || err.message, { depth: null });
  return { error: "DOP_APPROVE_FAILED" };
    
  }

  console.log("====================================================");
  console.log("🎉 OUT PASS AUTOMATION COMPLETED SUCCESSFULLY");
  console.log("====================================================");

  return {
    success: true,
    from: t.frdt,
    to: t.todt
  };
}

module.exports = { generateOutPass };
