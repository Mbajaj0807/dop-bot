const axios = require("axios");

const BASE = "https://student.bennetterp.camu.in";

async function fetchAttendance(session) {
  const api = axios.create({
    headers: {
      Cookie: session.cookie,
      "content-type": "application/json",
      appversion: "v2",
      clienttzofst: "330"
    },
    timeout: 15000
  });

  const payload = {
    InId: session.instituteId,
    PrID: session.prId,
    CrID: session.crId,
    DeptID: session.deptId,
    SemID: session.semId,
    AcYr: session.acYr,
    CmProgID: session.cmProgId,
    StuID: session.studentId,
    isFE: true,
    isForWeb: true,
    isFrAbLg: true
  };

  const res = await api.post(
    `${BASE}/api/Attendance/getDtaForStupage`,
    payload
  );

  const data = res.data?.output?.data;
  if (!data) return { error: "ATTENDANCE_NOT_FOUND" };

  return {
    percentage: data.OvrAllPrcntg,
    present: data.OvrAllPCnt,
    total: data.OvrAllCnt
  };
}

module.exports = { fetchAttendance };
