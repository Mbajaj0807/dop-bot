// src/fetchMessQR.js
const axios = require("axios");

const BASE = "https://student.bennetterp.camu.in";

async function fetchMessQR(session) {
  const api = axios.create({
    headers: {
      Cookie: session.cookie,
      "content-type": "application/json",
      appversion: "v2",
      clienttzofst: "330"
    },
    timeout: 15000
  });

  const res = await api.post(
    `${BASE}/api/mess-management/generate-permanent-qr-code`,
    {
      stuId: session.studentId,
      InId: session.instituteId,
      qrCdeGn: "2" // permanent QR
    }
  );

  const data = res.data?.output?.data;
  console.log(data.prQrCd, { depth: null });
  

  if (!data) {
    return { error: "QR_NOT_AVAILABLE" };
  }

  return data;
}

module.exports = { fetchMessQR };
