const express = require("express");
const router = express.Router();
const { ingestReadings } = require("../controllers/ingestController");

router.post("/", ingestReadings);

module.exports = router;
