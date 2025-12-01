const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

// Serve static files (HTML, CSS, JS, images)
app.use(express.static(__dirname));

// Sample appliance data structure
let applianceData = [
    { name: 'Refrigerator', circuit: 'C1', current: 8.2, voltage: 120.5, power: 988, status: 'On' },
    { name: 'Air Conditioner', circuit: 'C2', current: 12.5, voltage: 119.8, power: 1497, status: 'On' },
    { name: 'Washing Machine', circuit: 'C3', current: 6.8, voltage: 121.0, power: 823, status: 'Off' },
    { name: 'Dishwasher', circuit: 'C4', current: 10.2, voltage: 120.2, power: 1226, status: 'On' },
    { name: 'Microwave', circuit: 'C5', current: 4.5, voltage: 120.8, power: 544, status: 'Off' },
    { name: 'Oven', circuit: 'C6', current: 15.3, voltage: 119.5, power: 1828, status: 'On' }
];

// CSV Playback Engine - Placeholder
// TODO: Replace this with actual CSV reading when files are available
let csvData = [];
let currentRowIndex = 0;

/**
 * Load CSV files from the data directory
 * This is a placeholder - will be implemented when CSV files are provided
 */
function loadCSVData() {
    const dataDir = path.join(__dirname, 'data');

    // Check if data directory exists
    if (!fs.existsSync(dataDir)) {
        console.log('⚠️  Data directory not found. Creating placeholder...');
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('📁 Created data/ directory. Add your ESP32 CSV files here.');
        return false;
    }

    // TODO: Implement actual CSV parsing
    // Example for when CSV files are available:
    /*
    const csvFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));
    
    csvFiles.forEach(file => {
        const filePath = path.join(dataDir, file);
        const rows = [];
        
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                rows.push(row);
            })
            .on('end', () => {
                csvData.push({ filename: file, data: rows });
                console.log(`✅ Loaded ${file}: ${rows.length} rows`);
            });
    });
    */

    return false;
}

/**
 * Generate simulated sensor data
 * This simulates what would come from CSV files
 */
function generateSimulatedData() {
    // Calculate totals from appliances
    const totalPower = applianceData.reduce((sum, app) => sum + (app.status === 'On' ? app.power : 0), 0);
    const totalCurrent = applianceData.reduce((sum, app) => sum + (app.status === 'On' ? app.current : 0), 0);
    const avgVoltage = applianceData.reduce((sum, app) => sum + app.voltage, 0) / applianceData.length;

    // Add slight random fluctuations
    return {
        totalPower: (totalPower + (Math.random() - 0.5) * 50).toFixed(2),
        totalCurrent: (totalCurrent + (Math.random() - 0.5) * 0.5).toFixed(1),
        lineVoltage: (avgVoltage + (Math.random() - 0.5) * 2).toFixed(1),
        todayEnergy: (totalPower * 0.024 + Math.random() * 5).toFixed(2) // Simulated daily energy
    };
}

/**
 * Update appliance values with slight variations
 */
function updateApplianceData() {
    applianceData = applianceData.map(app => ({
        ...app,
        current: Math.max(0, app.current + (Math.random() - 0.5) * 0.5),
        voltage: app.voltage + (Math.random() - 0.5) * 1,
        power: Math.max(0, app.power + (Math.random() - 0.5) * 20)
    }));
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Send initial data to newly connected client
    socket.emit('initial-data', {
        dashboard: generateSimulatedData(),
        appliances: applianceData
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Data update loop - simulates streaming data
setInterval(() => {
    // TODO: When CSV files are available, read next row instead of generating
    // const nextRow = csvData[currentRowIndex];
    // currentRowIndex = (currentRowIndex + 1) % csvData.length;

    updateApplianceData();
    const dashboardData = generateSimulatedData();

    // Broadcast to all connected clients
    io.emit('dashboard-update', dashboardData);
    io.emit('appliance-update', applianceData);
}, 2000); // Update every 2 seconds

// Try to load CSV data on startup
const csvLoaded = loadCSVData();
if (!csvLoaded) {
    console.log('📊 Using simulated data until CSV files are added.');
}

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Smart Energy Meter server running on http://localhost:${PORT}`);
    console.log(`📂 Place ESP32 CSV files in: ${path.join(__dirname, 'data')}`);
});
