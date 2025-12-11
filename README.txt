================================================================================
SMART ENERGY METER - IOT POWER MONITORING SYSTEM
================================================================================

A comprehensive real-time energy monitoring system that collects power 
consumption data from an ESP32-based sensor and displays it on a web dashboard. 
The system consists of three main components: an ESP32 firmware, a Node.js/Express 
backend, and a responsive frontend web application.

================================================================================
TABLE OF CONTENTS
================================================================================

- Project Overview
- System Architecture
- Components
  - ESP32 Firmware
  - Backend Server
  - Frontend Dashboard
- Technologies Used
- Key Features
- Challenges Faced
- Setup Instructions
- Deployment
- Project Structure

================================================================================
PROJECT OVERVIEW
================================================================================

This Smart Energy Meter system monitors real-time electrical consumption by 
measuring voltage and current using sensors connected to an ESP32 microcontroller. 
The data is transmitted wirelessly to a cloud backend (Render) and displayed on 
a live web dashboard (Vercel).

KEY CAPABILITIES:
- Real-time voltage, current, and power monitoring
- Energy consumption tracking
- Dual WiFi support (home and school networks)
- Live web dashboard with interactive charts
- Mobile-responsive design

TESTING & DEMO SCOPE:
- The device has been tested only with a small fan due to hardware limitations
- ALL DATA SHOWN IN THE DEMO IS REAL-TIME DATA FROM THE FAN CONNECTED TO THE ESP32
- The system is designed to work with various AC devices, but testing was limited 
  to a single low-power device
- No simulated or sample data - all dashboard readings come directly from the 
  physical fan device

================================================================================
SYSTEM ARCHITECTURE
================================================================================

                    ESP32 Device          Backend           Frontend
                         |               (Render)          (Vercel)
                         |                  |                  |
                    Sensors                |                  |
                    WiFi Module            |                  |
                         |                 |                  |
                         | HTTPS POST      |                  |
                         |---------------->|                  |
                         |    /readings    |                  |
                         |                 |                  |
                         |                 | REST GET         |
                         |                 |<-----------------|
                         |                 |   /latest        |
                         |                 |                  |

DATA FLOW:
1. ESP32 reads sensors (current & voltage) every second FROM CONNECTED FAN
2. ESP32 calculates power and energy, formats as JSON
3. ESP32 sends data via HTTPS POST to Render backend
4. Backend stores latest reading in memory (Map data structure)
5. Frontend polls backend every 2 seconds via GET request
6. Frontend updates dashboard with new readings FROM FAN
7. Frontend displays real-time fan data in cards, tables, and charts

================================================================================
COMPONENTS
================================================================================

ESP32 FIRMWARE
--------------
File: ESP32/esp32_SEM.cpp

HARDWARE COMPONENTS:
- ACS712 Current Sensor (30A): Measures AC current via Hall effect sensor
  * Connected to GPIO 34 (ADC input)
  * Sensitivity: 66 mV/A (0.066 V/A)
  * Calibrated with zero-current offset
  * Tested with: Small fan only (hardware limitations)

- Passive Voltage Divider Module: Measures AC line voltage
  * Connected to GPIO 35 (ADC input)
  * Divider ratio: 5:1 (5.0x multiplier)
  * No VCC required (passive circuit)
  * GND -> ESP32 GND, Signal -> GPIO 35

TESTING NOTES:
- Device has only been tested with a small fan due to hardware shortages. The 
  system is designed to monitor any AC device up to 30A, but comprehensive 
  testing with multiple devices was not possible.

SOFTWARE LOGIC:

Sensor Reading:
  Current Sensor (RMS calculation):
  - Samples 500 ADC readings over ~250ms
  - Converts ADC to voltage, then to current (A)
  - Applies deadband filter (0.01A) to remove noise
  - Calculates RMS: sqrt(sum(I²) / samples)
  - Applies smoothing filter (30% new, 70% old)

  Voltage Sensor:
  - Samples 20 ADC readings
  - Converts ADC to Vout: (ADC / 4095.0) * 3.3V
  - Applies divider ratio: Vin = Vout * 5.0
  - Applies calibration offset
  - Stores in voltageRMS variable (2 decimal precision)

Power Calculation:
  realPower = voltageRMS * currentRMS  // Watts
  energyConsumed += realPower / 3600.0  // Watt-hours (accumulated)

WiFi Connectivity:
- Dual WiFi Support: Tries home WiFi first, then school WiFi (eduroam)
- Home WiFi: Basic WPA2 (SSID + password)
- School WiFi: WPA2-Enterprise (SSID + username + password)
- Automatic fallback and reconnection logic
- HTTPS POST to Render backend using WiFiClientSecure

Data Transmission Format (JSON):
  {
    "deviceId": "esp32_1",
    "voltage": 120.50,      // Volts (2 decimals)
    "current": 1500.0,      // Milliamps (mA)
    "power": 180.5,         // Watts
    "rawAdc": 2048,         // Current ADC reading
    "timestamp": 12345678   // Milliseconds since boot
  }

Key Algorithms:
- RMS Current Calculation: Takes multiple samples, squares each, averages, 
  then square root
- Voltage Divider Conversion: ADC -> Vout -> Vin using divider ratio
- Power Smoothing: Low-pass filter prevents rapid value jumps
- Energy Accumulation: Integrates power over time (Wh)

BACKEND SERVER
--------------
File: backend/server.js

Technology Stack:
- Node.js (JavaScript runtime)
- Express.js (Web framework)
- CORS (Cross-Origin Resource Sharing)
- In-Memory Storage (Map data structure)

Architecture:

Simplified REST API Design:
- Removed Socket.io for simplicity and Render compatibility
- Uses pure REST endpoints (GET/POST)
- Stateless design with in-memory storage
- CORS enabled for frontend access

API Endpoints:

1. POST /readings
   - Accepts: { deviceId, voltage, current, power, rawAdc, timestamp }
   - Stores latest reading per device in Map<deviceId, reading>
   - Returns: { ok: true }
   - Logic: Parses JSON, validates data, stores in memory

2. GET /latest?deviceId=esp32_1
   - Returns: Latest stored reading for specified device
   - Returns: {} if no reading found
   - Used by frontend for polling

Data Storage:
  const latestReadings = new Map();
  // Format: {
  //   "esp32_1": {
  //     deviceId: "esp32_1",
  //     voltage: 120.50,
  //     current: 1500.0,
  //     power: 180.5,
  //     rawAdc: 2048,
  //     timestamp: 12345678
  //   }
  // }

Why In-Memory Storage?
- Simple implementation for demo/class project
- Fast read/write operations
- No database dependency
- Data resets on server restart (acceptable for real-time monitoring)

Server Configuration:
- Port: Uses process.env.PORT (Render) or 3000 (local)
- CORS: Enabled for all origins (Vercel frontend + ESP32)
- JSON Parsing: express.json() middleware

FRONTEND DASHBOARD
------------------
Files: frontend/index.html, frontend/script.js, frontend/styles.css

Technology Stack:
- HTML5 (Structure)
- CSS3 (Styling, animations, responsive design)
- Vanilla JavaScript (No frameworks)
- Chart.js (Data visualization)
- Socket.io Client (Legacy, not actively used)
- Fetch API (REST API polling)

Features:

1. Real-Time Dashboard
   - Total Power: Displays in W or kW (auto-scales) - REAL-TIME FAN DATA
   - Total Current: Displays in mA or A (auto-scales) - REAL-TIME FAN DATA
   - Line Voltage: Always in Volts (V) with 2 decimal places - REAL-TIME FAN DATA
   - Energy Usage: Displays in mWh, Wh, or kWh (auto-scales) - REAL-TIME FAN DATA
   - Last Updated: Timestamp of most recent reading from ESP32-connected fan

2. Data Polling:
   // Polls backend every 2 seconds
   setInterval(() => {
       fetchLatestReading('esp32_1');
   }, 2000);

   // Fetches from: GET /latest?deviceId=esp32_1
   // Updates dashboard if data exists
   // All data is real-time from ESP32-connected fan (no simulated data)

3. Unit Formatting:
   - Intelligent unit conversion (mA -> A, W -> kW, mWh -> Wh -> kWh)
   - Formatting matches Serial Monitor output exactly
   - 2 decimal places for voltage (consistent across system)
   - 1 decimal place for current, power, energy

4. Responsive Design:
   - Mobile-first approach
   - CSS Grid and Flexbox layouts
   - Dark theme with green energy accents
   - Smooth animations and transitions

5. Interactive Charts:
   - Chart.js integration
   - Voltage over time (line chart) - shows real-time fan data
   - Current & Power over time (dual-axis chart) - shows real-time fan data
   - Weekly comparison (bar chart) - static sample data for UI demonstration

6. Connection Status:
   - Visual indicator (Connected / Offline)
   - Shows "Live (ESP32)" when receiving data
   - Auto-updates based on fetch success/failure

Key JavaScript Functions:
- fetchLatestReading(): Fetches data from backend REST API
- updateDashboard(): Updates UI with new sensor readings
- formatUnit(): Converts and formats units intelligently
- updateLastUpdated(): Updates timestamp display
- updateApplianceTable(): Displays appliance data (static sample data for UI 
  demonstration - actual readings show fan data only)

================================================================================
TECHNOLOGIES USED
================================================================================

HARDWARE:
- ESP32 Development Board (WiFi + Bluetooth enabled microcontroller)
- ACS712 Current Sensor (30A Hall effect sensor)
- Passive Voltage Divider Module (Resistor-based voltage sensor)

SOFTWARE & LIBRARIES:

ESP32 Firmware:
- Arduino Core for ESP32 (C++)
- WiFi.h (WiFi connectivity)
- HTTPClient.h (HTTP requests)
- WiFiClientSecure.h (HTTPS support)
- esp_wpa2.h (WPA2-Enterprise for school WiFi)
- math.h (RMS calculations)

Backend:
- Node.js (v14+)
- Express.js (^4.18.2)
- CORS (^2.8.5)

Frontend:
- HTML5 (Semantic markup)
- CSS3 (Modern styling, animations)
- JavaScript (ES6+) (Async/await, Fetch API)
- Chart.js (v3.x - Data visualization)
- Socket.io Client (v4.6.1 - Legacy, not actively used)

Development Tools:
- Arduino IDE / PlatformIO (ESP32 development)
- VS Code (Code editor)
- Git (Version control)
- GitHub (Code repository)
- Postman / curl (API testing)

Deployment Platforms:
- Render (Backend hosting - Free tier)
- Vercel (Frontend hosting - Free tier)
- GitHub (Code repository)

================================================================================
KEY FEATURES
================================================================================

1. Dual WiFi Support
   - Automatic switching between home and school networks
   - WPA2-Personal (home) and WPA2-Enterprise (eduroam)
   - Automatic reconnection on disconnect

2. Real-Time Monitoring
   - 1-second sensor sampling rate
   - 2-second dashboard updates
   - Live data visualization

3. Data Consistency
   - Same voltageRMS variable used for Serial Monitor and WiFi transmission
   - Consistent 2-decimal formatting across all outputs
   - Serial Monitor JSON matches website display format

4. Responsive Dashboard
   - Works on desktop, tablet, and mobile
   - Interactive charts with Chart.js
   - Real-time connection status indicator

5. Energy Tracking
   - Accumulates energy consumption (Wh)
   - Displays today's usage
   - Power averaging over 1-minute intervals

================================================================================
CHALLENGES FACED
================================================================================

1. SOCKET.IO DEPENDENCY ISSUES ON RENDER
Problem:
- Initial backend used Socket.io for real-time communication
- Render deployment failed with "Cannot find module 'socket.io'"
- Socket.io not compatible with Render's free tier constraints

Solution:
- Removed Socket.io entirely from backend
- Implemented REST API with polling (GET /latest endpoint)
- Frontend polls backend every 2 seconds using Fetch API
- Reduced backend complexity and dependencies

Lesson Learned:
- Simpler is better - REST API is more reliable for deployment
- Polling is acceptable for 2-second update intervals

2. DATA FORMAT CONSISTENCY BETWEEN SERIAL MONITOR AND WEBSITE
Problem:
- Serial Monitor showed raw values (Amps, Wh)
- Website displayed converted values (mA, mWh)
- Mismatch caused confusion during debugging
- Values didn't match between sources

Solution:
- Standardized on smaller units (mA, mWh) throughout the system
- Updated Serial Monitor to print both formats (mA + A for reference)
- Ensured same voltageRMS variable used everywhere
- Applied consistent formatting (2 decimals for voltage, 1 for others)

Code Changes:
  // Serial Monitor now outputs:
  {"current_mA":1500.0, "current_A":1.500, "voltage":120.50, ...}
  // WiFi sends same format as Serial Monitor displays

Lesson Learned:
- Single source of truth principle - one variable for voltage, format consistently
- Debugging is easier when all outputs match

3. VOLTAGE SENSOR INTEGRATION
Problem:
- Initially used hardcoded voltage assumption (120V)
- Needed real voltage measurements for accurate power calculations
- Had to integrate passive voltage divider module
- Uncertain about divider ratio and calibration

Solution:
- Researched voltage divider module specifications
- Implemented ADC sampling with averaging (20 samples)
- Applied divider ratio (5.0x) to convert Vout to Vin
- Added calibration offset parameter for fine-tuning
- Replaced all hardcoded voltage references with voltageRMS

Implementation:
  float vout = (adcAvg / 4095.0) * 3.3;  // ADC -> Voltage at pin
  float vin = vout * VOLTAGE_DIVIDER_RATIO;  // Apply divider ratio
  vin += VOLTAGE_CAL_OFFSET;  // Calibration adjustment
  voltageRMS = vin;  // Store for calculations

Lesson Learned:
- Sensor integration requires understanding hardware specifications
- Calibration is crucial for accurate measurements

4. HTTPS SUPPORT FOR RENDER DEPLOYMENT
Problem:
- ESP32 needed to send data to Render (HTTPS only)
- ESP32 HTTPClient doesn't support HTTPS by default
- Certificate validation issues

Solution:
- Used WiFiClientSecure library
- Implemented client.setInsecure() for demo (bypasses certificate validation)
- Added automatic detection of HTTP vs HTTPS URLs
- Maintained backward compatibility for local HTTP testing

Code:
  bool useHTTPS = (strstr(SERVER_URL, "https://") != NULL);
  if (useHTTPS) {
      WiFiClientSecure client;
      client.setInsecure();  // Accept any certificate (acceptable for demo)
      http.begin(client, SERVER_URL);
  }

Lesson Learned:
- HTTPS is required for production deployments
- Certificate validation can be bypassed for development/demo purposes
- Always support both HTTP (local) and HTTPS (production)

5. WIFI CONNECTION RELIABILITY
Problem:
- ESP32 occasionally disconnected from WiFi
- Connection lost during long-running sessions
- Needed to work at both home and school locations

Solution:
- Implemented automatic reconnection logic
- Added dual WiFi support (home + school)
- Periodic connection checks (every 30 seconds)
- Fallback mechanism: try home WiFi first, then school

Implementation:
  // Tries home WiFi, then school WiFi automatically
  if (connectToHomeWiFi()) return true;
  if (connectToSchoolWiFi()) return true;

Lesson Learned:
- Network reliability requires robust reconnection logic
- Multiple network options improve availability

6. RMS CURRENT CALCULATION ACCURACY
Problem:
- Initial current readings were noisy and inaccurate
- AC current requires RMS calculation, not just average
- Sensor noise caused false readings at low currents

Solution:
- Increased sample count (500 samples instead of 400)
- Implemented proper RMS calculation: sqrt(sum(I²) / samples)
- Added deadband filter (0.01A) to remove noise
- Applied smoothing filter to prevent rapid value jumps

Code:
  // RMS calculation
  sumI2 += (double)currentA * (double)currentA;  // Sum of squares
  currentRMS = sqrt(sumI2 / N_SAMPLES);  // Root mean square

  // Smoothing
  currentRMS = 0.3f * newRMS + 0.7f * currentRMS;  // Low-pass filter

Lesson Learned:
- AC measurements require RMS, not average
- Noise filtering is essential for accurate readings

7. FRONTEND-BACKEND COMMUNICATION
Problem:
- After removing Socket.io, frontend had no way to get updates
- Needed to implement polling mechanism
- CORS issues when frontend and backend on different domains

Solution:
- Implemented REST API polling (2-second intervals)
- Added CORS middleware to backend
- Created fetchLatestReading() function in frontend
- Added connection status indicator

Lesson Learned:
- REST + polling is simpler than WebSockets for this use case
- CORS must be configured for cross-origin requests

8. PACKAGE-LOCK.JSON DEPENDENCIES
Problem:
- package-lock.json still referenced socket.io after removal
- Render deployment would try to install removed dependencies
- Inconsistent dependency tree

Solution:
- Regenerated package-lock.json with npm install
- Removed socket.io and csv-parser from package.json
- Verified only express and cors remain

Lesson Learned:
- Always regenerate lock file after dependency changes
- Keep dependencies minimal for easier deployment

================================================================================
SETUP INSTRUCTIONS
================================================================================

Prerequisites:
- ESP32 development board
- Arduino IDE or PlatformIO
- Node.js (v14 or higher)
- Git
- Render account (free tier)
- Vercel account (free tier)

ESP32 Setup:

1. Install ESP32 Board Support:
   - Arduino IDE: File -> Preferences -> Additional Board URLs
   - Add: https://espressif.github.io/arduino-esp32/package_esp32_index.json
   - Tools -> Board -> Boards Manager -> Install "ESP32"

2. Install Required Libraries:
   - Built-in: WiFi, HTTPClient, WiFiClientSecure

3. Configure WiFi:
   - Edit ESP32/esp32_SEM.cpp
   - Update HOME_SSID and HOME_PASSWORD
   - Update SCHOOL_SSID, SCHOOL_USERNAME, SCHOOL_PASSWORD

4. Configure Backend URL:
   - Update SERVER_URL with your Render backend URL

5. Upload to ESP32:
   - Select board: "ESP32 Dev Module"
   - Select port: Your ESP32 COM port
   - Click Upload

Backend Setup:

1. Navigate to backend directory:
   cd backend

2. Install dependencies:
   npm install

3. Run locally:
   npm start
   Server runs on http://localhost:3000

4. Test endpoints:
   # POST test data
   curl -X POST http://localhost:3000/readings \
     -H "Content-Type: application/json" \
     -d '{"deviceId":"esp32_1","voltage":120.5,"current":1500,"power":180.5,"rawAdc":2048,"timestamp":12345678}'
   
   # GET latest reading
   curl http://localhost:3000/latest?deviceId=esp32_1

Frontend Setup:

1. Open frontend/index.html in browser:
   - Or use a local server:
   cd frontend
   python -m http.server 8000
   # Open http://localhost:8000

2. Update Backend URL (if needed):
   - Edit frontend/script.js
   - Update BACKEND_URL constant

================================================================================
DEPLOYMENT
================================================================================

Backend (Render):

1. Push code to GitHub:
   git add backend/
   git commit -m "Deploy backend"
   git push origin main

2. Create Render Service:
   - Go to https://dashboard.render.com
   - New -> Web Service
   - Connect GitHub repository
   - Settings:
     - Root Directory: backend
     - Build Command: npm install
     - Start Command: npm start
     - Environment: Node

3. Deploy:
   - Render automatically deploys on git push
   - Get your backend URL: https://your-app.onrender.com

Frontend (Vercel):

1. Update Backend URL:
   - Edit frontend/script.js
   - Update BACKEND_URL to your Render URL

2. Deploy to Vercel:
   - Go to https://vercel.com
   - Import Git Repository
   - Settings:
     - Root Directory: frontend
     - Framework Preset: Other
   - Deploy

3. Update ESP32:
   - Edit ESP32/esp32_SEM.cpp
   - Update SERVER_URL to your Render URL

================================================================================
PROJECT STRUCTURE
================================================================================

smartmeter_website_frontend/
├── ESP32/
│   └── esp32_SEM.cpp          # ESP32 firmware (main file)
├── backend/
│   ├── server.js              # Express backend server
│   ├── package.json           # Node.js dependencies
│   └── package-lock.json      # Dependency lock file
├── frontend/
│   ├── index.html             # Main HTML file
│   ├── script.js              # Frontend JavaScript
│   ├── styles.css             # CSS styling
│   └── meter.png              # Logo/icon
├── firmware/                  # Alternative ESP32 location
├── js/                        # Additional JavaScript utilities
├── description/               # Documentation files
└── README.txt                 # This file

================================================================================
DATA FLOW DIAGRAM
================================================================================

ESP32 Firmware
    │
    ├─> Read Sensors (Current + Voltage)
    ├─> Calculate RMS Current
    ├─> Calculate Voltage (with divider)
    ├─> Calculate Power (V × I)
    ├─> Accumulate Energy
    │
    └─> HTTPS POST to Render
        │
        └─> Backend (server.js)
            │
            ├─> Store in Memory (Map)
            │
            └─> <─ REST GET (polling every 2s)
                │
                └─> Frontend (script.js)
                    │
                    ├─> Update Dashboard Cards
                    ├─> Update Charts
                    ├─> Update Appliance Table
                    └─> Update Connection Status
================================================================================
AUTHORS
================================================================================

- Raghav Kalani, Pratham Patel, Ashley Nwadike - ESP32 Firmware, Backend, Frontend Development
================================
FUTURE IMPROVEMENTS
================================================================================

- Database integration (MongoDB/PostgreSQL) for historical data
- User authentication and multi-device support
- Mobile app (React Native)
- Energy cost calculations based on utility rates
- Historical data visualization (24h, 7d, 30d charts)
- Device management dashboard
- OTA (Over-The-Air) firmware updates
- WebSocket implementation for true real-time updates
- MQTT protocol for lower power consumption
- Comprehensive testing with multiple devices (refrigerator, AC, heaters, etc.)

================================================================================
SUPPORT
================================================================================

For issues or questions, please create an issue in the GitHub repository.

================================================================================

Links-

HARDWARE & ESP32 RESOURCES
---------------------------

ESP32 (Microcontroller & Coding):
- ESP32 Arduino Core Documentation
  https://espressif-docs.readthedocs-hosted.com/projects/arduino-esp32/en/latest/

- Installing ESP32 support in Arduino IDE
  https://espressif-docs.readthedocs-hosted.com/projects/arduino-esp32/en/latest/installing.html

- Arduino core for the ESP32 (GitHub repo)
  https://github.com/espressif/arduino-esp32

- ESP32 Hardware Reference (datasheet, design guidelines, boards)
  https://espressif-docs.readthedocs-hosted.com/projects/esp-idf/en/stable/hw-reference/

- ESP32 Technical Reference Manual (low-level peripherals, timers, ADC, etc.)
  https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf

Current Sensor (ACS712):
- ACS712 Official Product Page (overview & characteristics)
  https://www.allegromicro.com/en/products/sense/current-sensor-ics/integrated-current-sensors/acs712

- ACS712 Datasheet (PDF)
  https://www.allegromicro.com/-/media/files/datasheets/acs712-datasheet.ashx

Voltage Sensor (example: ZMPT101B AC Voltage Module):
- ZMPT101B Voltage Transformer Datasheet (PDF)
  https://innovatorsguru.com/wp-content/uploads/2019/02/ZMPT101B.pdf

- ZMPT101B AC Voltage Sensor Module (module-level description & specs)
  https://datacapturecontrol.com/articles/io-components/sensors/voltage/zmpt101b-ac-voltage-transformer-sensor-module

General Module Info:
- ESP32 DevKitC / Modules & Boards (official hardware list & pinouts)
  https://espressif-docs.readthedocs-hosted.com/projects/esp-idf/en/stable/hw-reference/index.html

================================================================================

Last Updated: December 2025
