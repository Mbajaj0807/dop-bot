const axios = require("axios");
const { getOutpassWindow } = require("./time");

const BASE = "https://student.bennetterp.camu.in";

async function generateOutPass(session, reason) {
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
  let leaveDate;

  try {
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
      rson: "Leave",
      periods: [],
      atcmnt: []
    };

    const leaveRes = await api.post(
      `${BASE}/api/Leave/crtLv`,
      leavePayload
    );

    const leaveData = leaveRes.data.output.data;
    leaveRefId = leaveData.refId;
    leaveDate = leaveData.start;

    if (!leaveRefId || !leaveDate) {
      return { error: "LEAVE_DATA_INVALID" };
    }
  } catch {
    return { error: "LEAVE_FAILED" };
  }

  /* =====================================================
     STEP 2: CALCULATE TIME WINDOW
  ===================================================== */
  const t = getOutpassWindow(leaveDate);
  if (!t) return { error: "Time is past 7:00 PM IST" };

  /* =====================================================
     STEP 3: CREATE DOP
  ===================================================== */
  try {
    const dopPayload = {
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
      rson: reason
    };

    await api.post(`${BASE}/api/Leave/crtLv`, dopPayload);
  } catch {
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

    const allDops = listRes.data.output.data
      .filter(d =>
        d.isGatepass === true &&
        d.passTyCode === "DOP" &&
        d.frdt?.startsWith(leaveDate.slice(0, 10))
      )
      .sort((a, b) => new Date(b.CrAt) - new Date(a.CrAt));

    dop = allDops[0];

    if (!dop || !dop._id) {
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
