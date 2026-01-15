const axios = require("axios");

const BASE = "https://student.bennetterp.camu.in";

async function loginERP(email, password) {
  const res = await axios.post(
    `${BASE}/login/validate`,
    { dtype: "M", Email: email, pwd: password },
    { withCredentials: true }
  );

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

module.exports = { loginERP };
