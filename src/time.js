function getISTNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
}

function getOutpassWindow() {
  const nowIST = getISTNow();

  // Base date = TODAY (IST)
  const base = new Date(nowIST);
  base.setHours(0, 0, 0, 0);

  // Start = now + 1 minute (same day)
  const start = new Date(base);
  start.setHours(
    nowIST.getHours(),
    nowIST.getMinutes() + 1,
    nowIST.getSeconds(),
    0
  );

  // End = 7:00 PM IST
  const end = new Date(base);
  end.setHours(19, 0, 0, 0);

  // Safety check
  if (start >= end) return null;

  return {
    frdt: start.toISOString(),
    todt: end.toISOString()
  };
}

module.exports = { getOutpassWindow };
