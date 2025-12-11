const express = require('express');
const cors = require('cors');

const app = express();

// Use Render port or fallback to 3000 for local development
const PORT = process.env.PORT || 3000;

// CORS middleware (enable for Vercel frontend and ESP32)
app.use(cors());

// Middleware to parse JSON
app.use(express.json());


// Store latest readings by deviceId (for REST API endpoints)
// Format: { deviceId: { deviceId, voltage, current, power, rawAdc, timestamp } }
const latestReadings = new Map();

// ============= REST API ENDPOINTS =============

// POST /readings - Store latest reading from ESP32
// Accepts: { deviceId, voltage, current, power, rawAdc, timestamp }
app.post('/readings', (req, res) => {
    const { deviceId = 'esp32_1', voltage, current, power, rawAdc, timestamp } = req.body;
    
    // Store latest reading for this device
    latestReadings.set(deviceId, {
        deviceId,
        voltage: parseFloat(voltage) || 0,
        current: parseFloat(current) || 0,
        power: parseFloat(power) || 0,
        rawAdc: parseInt(rawAdc) || 0,
        timestamp: timestamp || Date.now()
    });
    
    console.log(`📡 Stored reading for ${deviceId}:`, latestReadings.get(deviceId));
    
    res.json({ ok: true });
});

// GET /latest?deviceId=esp32_1 - Get latest reading for a device
app.get('/latest', (req, res) => {
    const deviceId = req.query.deviceId || 'esp32_1';
    const reading = latestReadings.get(deviceId);
    
    console.log(`📥 GET /latest request for ${deviceId}, has data: ${!!reading}`);
    
    if (reading) {
        console.log(`📤 Sending reading:`, reading);
        res.json(reading);
    } else {
        console.log(`📭 No reading found for ${deviceId}`);
        res.json({});
    }
});

// Start server (Render-compatible)
app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on', PORT);
    console.log(`📡 REST API endpoints:`);
    console.log(`   POST /readings`);
    console.log(`   GET  /latest?deviceId=esp32_1`);
});
