//Outpass 

const axios = require("axios");
const { getOutpassWindow } = require("./time");

const BASE = "https://student.bennetterp.camu.in";

async function generateOutPass(session) {
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
     STEP 1: CREATE LEAVE (WITH FALLBACK)
  ===================================================== */
  let leaveRefId;
  let leaveDate;

  // leave date = today IST (midnight UTC returned by ERP)
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

  try {
    const leaveRes = await api.post(
      `${BASE}/api/Leave/crtLv`,
      leavePayload
    );

    const output = leaveRes.data?.output;

    // ✅ CASE 1: Leave created successfully
    if (output?.data) {
      leaveRefId = output.data.refId;
      leaveDate = output.data.start;
    } 
    // 🔁 CASE 2: Leave already exists → FALLBACK
    else {
      const listRes = await api.post(
        `${BASE}/api/Leave/getAllleave/`,
        {
          StuID: session.studentId,
          isFrmReact: true
        }
      );

      const existingLeave = listRes.data.output.data.find(
        d =>
          d.LvTy === "Leave" &&
          d.start?.startsWith(today.toISOString().slice(0, 10))
      );

      if (!existingLeave) {
        return { error: "LEAVE_NOT_FOUND" };
      }

      leaveRefId = existingLeave.refId;
      leaveDate = existingLeave.start;
    }

    if (!leaveRefId || !leaveDate) {
      return { error: "LEAVE_DATA_INVALID" };
    }

  } catch (err) {
    return { error: "LEAVE_FAILED" };
  }

  /* =====================================================
     STEP 2: CALCULATE OUTPASS WINDOW (ON LEAVE DATE)
  ===================================================== */
  const t = getOutpassWindow(leaveDate);
  if (!t) return { error: "TOO_LATE" };

  /* =====================================================
     STEP 3: CREATE DOP
  ===================================================== */
  try {
    await api.post(`${BASE}/api/Leave/crtLv`, {
      PerTy: "Student",
      PerId: session.studentId,
      PerNm: session.studentName,
      InId: session.instituteId,
      HstleReq: "true",
      LvTy: "Leave",

      GateOutPass: true,
      passTy: "DOP",

      FrDt: leaveDate,
      ToDt: leaveDate,
      frdt: t.frdt,
      todt: t.todt,

      refId: leaveRefId,
      Type: "student",
      loggedInId: session.studentId,
      stuId: session.studentId,
      timezoneOffSet: 330,
      rson: "Going out"
    });
  } catch (err) {
    return { error: "DOP_CREATE_FAILED" };
  }

  /* =====================================================
     STEP 4: FETCH DOP
  ===================================================== */
  let dop;
  try {
    const listRes = await api.post(
      `${BASE}/api/Leave/getAllleave/`,
      {
        StuID: session.studentId,
        isFrmReact: true
      }
    );

    dop = listRes.data.output.data
      .filter(d =>
        d.isGatepass === true &&
        d.passTyCode === "DOP" &&
        d.frdt?.startsWith(leaveDate.slice(0, 10))
      )
      .sort((a, b) => new Date(b.CrAt) - new Date(a.CrAt))[0];

    if (!dop?._id) {
      return { error: "DOP_NOT_FOUND" };
    }
  } catch {
    return { error: "DOP_FETCH_FAILED" };
  }

  /* =====================================================
     STEP 5: APPROVE DOP
  ===================================================== */
  try {
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
  } catch {
    return { error: "DOP_APPROVE_FAILED" };
  }

  return {
    success: true,
    from: t.frdt,
    to: t.todt
  };
}

module.exports = { generateOutPass };
