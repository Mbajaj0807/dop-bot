const axios = require("axios");

const BASE = "https://student.bennetterp.camu.in";

async function fetchMessMenu(session) {
  const api = axios.create({
    headers: {
      Cookie: session.cookie,
      "content-type": "application/json",
      appversion: "v2",
      clienttzofst: "330"
    },
    timeout: 15000
  });

  let res;
  try {
    res = await api.post(
      `${BASE}/api/mess-management/get-student-menu-list`,
      {
        stuId: session.studentId,
        InId: session.instituteId
      }
    );
  } catch (err) {
    console.error("❌ MESS API REQUEST FAILED");
    console.error(err.response?.data || err.message);
    return { error: "API_FAILED" };
  }

  // 🔍 FULL DEBUG (TEMPORARY – KEEP FOR NOW)
  console.log("📥 MESS MENU RAW RESPONSE:");
  console.dir(res.data, { depth: null });

  const output = res.data?.output;
  const data = output?.data;

  // 🚫 ERP-level errors
  if (output?.errors) {
    console.error("❌ ERP ERROR:", output.errors);
    return { error: "ERP_ERROR" };
  }

  // 🚫 No data at all
  if (!data) {
    return { error: "NO_MENU_DATA" };
  }

  // 🚫 Menu not active
  if (data.isAtve !== true) {
    return { error: "MENU_INACTIVE" };
  }

  // 🚫 Meal list missing (this should basically never happen)
  if (!Array.isArray(data.oMealList)) {
    return { error: "MEAL_LIST_INVALID" };
  }

  // ✅ SUCCESS
  return {
    facility: data.facNme,
    date: new Date(data.curntDte).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short"
    }),
    meals: data.oMealList
  };
}

module.exports = { fetchMessMenu };
