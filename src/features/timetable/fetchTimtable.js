const axios = require("axios");

const BASE = "https://student.bennetterp.camu.in";

async function fetchTimetable(session) {
  const api = axios.create({
    headers: {
      Cookie: session.cookie,
      "content-type": "application/json",
      appversion: "v2",
      clienttzofst: "330"
    },
    timeout: 15000
  });

  const today = new Date().toISOString().slice(0, 10);

  const res = await api.post(`${BASE}/api/Timetable/get`, {
    PrID: session.prId,
    CrID: session.crId,
    DeptID: session.deptId,
    SemID: session.semId,
    AcYr: session.acYr,
    start: today,
    end: today,
    usrTime: new Date().toLocaleString("en-IN"),
    schdlTyp: "slctdSchdl",
    isShowCancelledPeriod: true,
    isFromTt: true
  });
  

  const blocks = res.data?.output?.data || [];

  if (!blocks.length) return [];

  const periods = [];

  for (const block of blocks) {
    for (const p of block.Periods || []) {
      periods.push({
        start: p.FrTime,
        startISO: p.start,
        endISO: p.end,
        subject: p.SubNa,
        subjectId: p.SubID,
        type: p.subTyp === "LEC" ? "📘 Lecture" : "🖥️ Practical",
        room: p.Location,
        faculty: p.StaffNm
      });
    }
  }

  return periods.sort(
    (a, b) => new Date(a.startISO) - new Date(b.startISO)
  );
}

module.exports = { fetchTimetable };
