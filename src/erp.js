const axios = require("axios");

const BASE = "https://student.bennetterp.camu.in";

async function loginERP(email, password) {
  console.log("➡️ Logging in to ERP for:", email);
  const res = await axios.post(
    `${BASE}/login/validate`,
    { dtype: "M", Email: email, pwd: password },
    { withCredentials: true }
  );
  console.log("📥 ERP LOGIN RESPONSE:" , res.data);

  const cookie = res.headers["set-cookie"]
    ?.find(c => c.includes("connect.sid"))
    ?.split(";")[0];

  if (!cookie) throw new Error("SESSION_COOKIE_NOT_FOUND");

  const data = res.data.output.data.logindetails;

  const student = data.Student[0];

  return {
    cookie,
    parentId: data._id,
    studentId: student.StuID,
    studentName: `${student.FNa} ${student.LNa}`,
    instituteId: data.InId
  };
}

async function fetchStudentProgress(studentId, cookie) {
  const url = `${BASE}/api/studentprog/getAllProgressByStudID/${studentId}/undefined`;
  const res = await axios.get(url, {
    headers: {
      accept: "application/json, text/plain, */*",
      appversion: "v2",
      clienttzofst: "330",
      referer: "https://student.bennetterp.camu.in/v2/attendance",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

      
      Cookie: cookie
    },
    timeout: 20000
  });

  const list = res.data?.output?.data;
  console.log("📥 STUDENT PROGRESS RESPONSE:", res.data);
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("NO_PROGRESSION_DATA");
  }

  return list[0]; // latest / active semester
}


module.exports = { loginERP, fetchStudentProgress };
