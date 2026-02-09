function calculateAttendanceImpact(present, total) {
  const currentPercent = (present / total) * 100;

  if (currentPercent < 75) {
    let need = 0;
    let p = present;
    let t = total;

    while ((p / t) * 100 < 75) {
      p++;
      t++;
      need++;
    }

    return {
      status: "LOW",
      currentPercent: currentPercent.toFixed(2),
      classesToAttend: need
    };
  } else {
    let canMiss = 0;
    let p = present;
    let t = total;

    while (((p) / (t + 1)) * 100 >= 75) {
      t++;
      canMiss++;
    }

    return {
      status: "SAFE",
      currentPercent: currentPercent.toFixed(2),
      classesCanMiss: canMiss
    };
  }
}

module.exports = { calculateAttendanceImpact };
