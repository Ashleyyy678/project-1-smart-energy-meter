const Device = require("../models/Device");
const Reading = require("../models/Reading");

async function ingestReadings(req, res) {
  try {
    const { deviceId, apiKey, readings } = req.body;

    if (!deviceId || !apiKey || !Array.isArray(readings)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const device = await Device.findOne({ deviceId });
    if (!device || device.apiKey !== apiKey) {
      return res.status(401).json({ error: "Invalid device credentials" });
    }

    const docs = readings.map(r => ({
      deviceId: device._id,
      circuitLabel: r.circuitLabel,
      ts: new Date(r.ts),
      voltage: r.voltage,
      current: r.current,
      realPower: r.realPower,
      apparentPower: r.apparentPower,
      powerFactor: r.powerFactor
    }));

    await Reading.insertMany(docs);

    device.lastSeenAt = new Date();
    device.status = "online";
    await device.save();

    res.json({ ok: true, inserted: docs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { ingestReadings };
