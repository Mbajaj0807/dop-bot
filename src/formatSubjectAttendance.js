function formatSubject(subject) {
  const percent = subject.OvrAllPrcntg ?? subject.prsPercnt ?? 0;

  return (
    `📘 *${subject.SubjNm}* (${subject.SubjCd})\n` +
    // `• Type: ${subject.AttType}\n` +
    `• Present: ${subject.prsentCnt}\n` +
    `• Absent: ${subject.absentCnt}\n` +
    `• Total: ${subject.all}\n` +
    `• Attendance: *${percent}%*\n`
  );
}

module.exports = { formatSubject };
