const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  telegramUserId: String,

  // auth
  cookie: String,

  // identity
  studentId: String,
  studentName: String,
  parentId: String,
  instituteId: String,

  // academic context (NEW)
  prId: String,
  crId: String,
  deptId: String,
  semId: String,
  acYr: String,
  cmProgId: String,

  createdAt: Date,
  lastUsedAt: Date
});

module.exports = mongoose.model("Session", SessionSchema);
