const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  telegramUserId: { type: String, unique: true },
  cookie: String,
  parentId: String,
  studentId: String,
  studentName: String,
  instituteId: String,
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: Date
});

module.exports = mongoose.model("Session", SessionSchema);
