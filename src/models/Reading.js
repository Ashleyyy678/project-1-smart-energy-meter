const mongoose = require("mongoose");

const readingSchema = new mongoose.Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Device", required: true },
  circuitId: { type: mongoose.Schema.Types.ObjectId, ref: "Circuit", required: true },
  ts: { type: Date, required: true, index: true },
  voltage: Number,
  current: Number,
  realPower: Number,
  apparentPower: Number,
  powerFactor: Number
});

module.exports = mongoose.model("Reading", readingSchema);
