// Backend base URL - Render deployment
// For local development, use: http://localhost:3000
// For production (Vercel), use: https://smart-energy-meter-f2vv.onrender.com
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://smart-energy-meter-f2vv.onrender.com';

// Note: Backend no longer uses Socket.io - using REST API polling instead
// Socket.io is removed to prevent false connection status

// Connection status indicator
let connectionStatus = {
    connected: false,
    usingESP32: false,
    lastDataTimestamp: null  // Track when we last received ESP32 data
};

function updateConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        // Only show "Live (ESP32)" if we actually have recent ESP32 data
        if (connectionStatus.usingESP32 && connectionStatus.connected) {
            // Check if data is stale (older than 10 seconds = ESP32 likely disconnected)
            const now = Date.now();
            const timeSinceLastData = connectionStatus.lastDataTimestamp 
                ? (now - connectionStatus.lastDataTimestamp) 
                : Infinity;
            
            if (timeSinceLastData < 10000) {  // Less than 10 seconds = still live
                statusEl.textContent = '🟢 Live (ESP32)';
                statusEl.className = 'connection-status connected';
            } else {
                statusEl.textContent = '🔴 ESP32 Disconnected';
                statusEl.className = 'connection-status disconnected';
                connectionStatus.usingESP32 = false;
                connectionStatus.connected = false;
            }
        } else {
            statusEl.textContent = '🔴 Offline';
            statusEl.className = 'connection-status disconnected';
        }
    }
}

// Socket.io removed - backend now uses REST API only
// All updates come through fetchLatestReading() polling

// ============= REST API Polling (Primary method - backend no longer uses Socket.io) =============

// Fetch latest reading from backend REST API
async function fetchLatestReading(deviceId = 'esp32_1') {
    try {
        const response = await fetch(`${BACKEND_URL}/latest?deviceId=${deviceId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        // Check if backend returned actual ESP32 data (not empty object)
        if (data && Object.keys(data).length > 0 && (data.voltage !== undefined || data.current !== undefined || data.power !== undefined)) {
            // Convert REST API format to dashboard format
            const dashboardData = {
                totalCurrent: data.current || 0,
                totalPower: data.power || 0,
                voltage: data.voltage || 0,
                lineVoltage: data.voltage || 0,
                todayEnergy: 0  // REST API doesn't include energy, keep at 0 or calculate
            };
            
            updateDashboard(dashboardData);
            // ESP32 timestamp is millis() since boot, so use current time for display
            const now = new Date();
            updateLastUpdated(now);
            
            // Mark as connected with ESP32 data (use current time for staleness detection)
            connectionStatus.connected = true;
            connectionStatus.usingESP32 = true;
            connectionStatus.lastDataTimestamp = now.getTime();  // Store when we received this data
            updateConnectionStatus();
        } else {
            // Backend is reachable but no ESP32 data available
            connectionStatus.connected = false;
            connectionStatus.usingESP32 = false;
            updateConnectionStatus();
        }
    } catch (error) {
        console.error('Failed to fetch latest reading:', error);
        // Backend is not reachable
        connectionStatus.connected = false;
        connectionStatus.usingESP32 = false;
        updateConnectionStatus();
    }
}

// Update "Last updated" timestamp display
function updateLastUpdated(timestamp) {
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl) {
        const timeStr = timestamp.toLocaleTimeString();
        lastUpdatedEl.textContent = `Last updated: ${timeStr}`;
    }
}

// Poll REST API every 2 seconds to check for ESP32 data
setInterval(() => {
    fetchLatestReading();
    // Also update connection status to check for stale data
    updateConnectionStatus();
}, 2000);

//Sample Data
const sampleAppliances = [
    { name: 'Air Conditioner', circuit: 'Living Room', current: 8.5, voltage: 120.2, power: 1020, status: 'On' },
    { name: 'Refrigerator', circuit: 'Kitchen', current: 2.1, voltage: 119.8, power: 252, status: 'On' },
    { name: 'Washing Machine', circuit: 'Laundry Room', current: 0, voltage: 120.0, power: 0, status: 'Off' },
    { name: 'Television', circuit: 'Living Room', current: 1.2, voltage: 120.1, power: 144, status: 'On' },
    { name: 'Microwave', circuit: 'Kitchen', current: 12.5, voltage: 119.5, power: 1500, status: 'On' },
    { name: 'Dishwasher', circuit: 'Kitchen', current: 0, voltage: 120.0, power: 0, status: 'Off' },
    { name: 'Coffee Maker', circuit: 'Kitchen', current: 8.3, voltage: 120.3, power: 996, status: 'On' },
    { name: 'Laptop Charger', circuit: 'Office', current: 0.5, voltage: 120.2, power: 60, status: 'On' },
    { name: 'LED Lights', circuit: 'Living Room', current: 0.8, voltage: 120.0, power: 96, status: 'On' },
    { name: 'Heating Unit', circuit: 'Basement', current: 0, voltage: 120.1, power: 0, status: 'Off' }
];

const sampleAlerts = [
    { type: 'Overcurrent', appliance: 'Microwave', time: '2 minutes ago', description: 'Current spike detected: 12.5A', severity: 'critical' },
    { type: 'Unusual Spike', appliance: 'Air Conditioner', time: '15 minutes ago', description: 'Power consumption increased by 15%', severity: 'warning' },
    { type: 'Overvoltage', appliance: 'Main Circuit', time: '1 hour ago', description: 'Voltage reading: 125V (above normal)', severity: 'warning' }
];

const sampleAlertHistory = [
    { time: '2 hours ago', type: 'Overcurrent', appliance: 'Coffee Maker', description: 'Current exceeded 8A threshold', severity: 'warning' },
    { time: '5 hours ago', type: 'Unusual Spike', appliance: 'Television', description: 'Sudden power increase detected', severity: 'info' },
    { time: '1 day ago', type: 'Overvoltage', appliance: 'Main Circuit', description: 'Voltage spike: 127V', severity: 'critical' },
    { time: '2 days ago', type: 'Overcurrent', appliance: 'Washing Machine', description: 'Startup current: 15A', severity: 'warning' },
    { time: '3 days ago', type: 'Unusual Spike', appliance: 'Refrigerator', description: 'Compressor cycle detected', severity: 'info' }
];

// Initialize Charts
let voltageChart, powerChart, weeklyChart;

function initCharts() {
    // Generate sample time data (last 24 hours)
    const hours = [];
    for (let i = 23; i >= 0; i--) {
        const date = new Date();
        date.setHours(date.getHours() - i);
        hours.push(date.getHours().toString().padStart(2, '0') + ':00');
    }

    // Voltage Chart
    const voltageCtx = document.getElementById('voltageChart');
    const voltageData = hours.map(() => 115 + Math.random() * 10); // 115-125V range

    voltageChart = new Chart(voltageCtx, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [{
                label: 'Voltage (V)',
                data: voltageData,
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#b8bcc8'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#b8bcc8' },
                    grid: { color: '#2a2f44' }
                },
                y: {
                    ticks: { color: '#b8bcc8' },
                    grid: { color: '#2a2f44' },
                    title: {
                        display: true,
                        text: 'Voltage (V)',
                        color: '#b8bcc8'
                    }
                }
            }
        }
    });

    // Power & Current Chart
    const powerCtx = document.getElementById('powerChart');
    const currentData = hours.map(() => 5 + Math.random() * 8); // 5-13A range
    const powerData = hours.map((_, i) => currentData[i] * (115 + Math.random() * 10)); // P = I * V

    powerChart = new Chart(powerCtx, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [
                {
                    label: 'Current (A)',
                    data: currentData,
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Power (W)',
                    data: powerData,
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#b8bcc8'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#b8bcc8' },
                    grid: { color: '#2a2f44' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: { color: '#b8bcc8' },
                    grid: { color: '#2a2f44' },
                    title: {
                        display: true,
                        text: 'Current (A)',
                        color: '#b8bcc8'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    ticks: { color: '#b8bcc8' },
                    grid: { drawOnChartArea: false },
                    title: {
                        display: true,
                        text: 'Power (W)',
                        color: '#b8bcc8'
                    }
                }
            }
        }
    });

    // Weekly Comparison Chart
    const weeklyCtx = document.getElementById('weeklyChart');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyData = days.map(() => 15 + Math.random() * 10); // 15-25 kWh range

    weeklyChart = new Chart(weeklyCtx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Energy (kWh)',
                data: weeklyData,
                backgroundColor: 'rgba(0, 212, 255, 0.6)',
                borderColor: '#00d4ff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: { color: '#b8bcc8' },
                    grid: { color: '#2a2f44' }
                },
                y: {
                    ticks: { color: '#b8bcc8' },
                    grid: { color: '#2a2f44' },
                    title: {
                        display: true,
                        text: 'Energy (kWh)',
                        color: '#b8bcc8'
                    }
                }
            }
        }
    });
}

// Update dashboard values from server data
// Update dashboard values from server data
function updateDashboard(data) {
    const totalPower = document.getElementById('total-power');
    const totalCurrent = document.getElementById('total-current');
    const lineVoltage = document.getElementById('line-voltage');
    const todayEnergy = document.getElementById('today-energy');

    const totalPowerLabel = document.getElementById('total-power-label');
    const totalCurrentLabel = document.getElementById('total-current-label');
    const lineVoltageLabel = document.getElementById('line-voltage-label');
    const todayEnergyLabel = document.getElementById('today-energy-label');

    // Helper to format units
    const formatUnit = (value, type) => {
        if (value === undefined || value === null || isNaN(value)) return { value: '0.0', unit: '' };

        let val = parseFloat(value);
        let unit = '';

        switch (type) {
            case 'power': // Input in Watts
                if (val >= 1000) {
                    val = val / 1000;
                    unit = 'kW';
                } else {
                    unit = 'W';
                }
                break;
            case 'current': // Input in mA
                if (val >= 1000) {
                    val = val / 1000;
                    unit = 'A';
                } else {
                    unit = 'mA';
                }
                break;
            case 'voltage': // Input in Volts
                unit = 'V';
                break;
            case 'energy': // Input in mWh
                if (val >= 1000000) { // 1000 Wh = 1 kWh = 1,000,000 mWh
                    val = val / 1000000;
                    unit = 'kWh';
                } else if (val >= 1000) {
                    val = val / 1000;
                    unit = 'Wh';
                } else {
                    unit = 'mWh';
                }
                break;
        }
        return { value: val.toFixed(1), unit };
    };

    if (totalPower && data.totalPower !== undefined) {
        const { value, unit } = formatUnit(data.totalPower, 'power');
        totalPower.textContent = value;
        if (totalPowerLabel) totalPowerLabel.textContent = `Total Power (${unit})`;
    }

    if (totalCurrent && data.totalCurrent !== undefined) {
        const { value, unit } = formatUnit(data.totalCurrent, 'current');
        totalCurrent.textContent = value;
        if (totalCurrentLabel) totalCurrentLabel.textContent = `Total Current (${unit})`;
    }

    if (lineVoltage && (data.lineVoltage !== undefined || data.voltage !== undefined)) {
        // Use voltage field if present, otherwise lineVoltage (matches Serial Monitor format)
        // Backend sends with 2 decimal places, display with same precision
        const voltageValue = parseFloat(data.voltage || data.lineVoltage);
        if (!isNaN(voltageValue)) {
            lineVoltage.textContent = voltageValue.toFixed(2);  // 2 decimals, matches Serial
            if (lineVoltageLabel) lineVoltageLabel.textContent = 'Line Voltage (V)';  // Match Serial label
        }
    }

    if (todayEnergy && data.todayEnergy !== undefined) {
        const { value, unit } = formatUnit(data.todayEnergy, 'energy');
        todayEnergy.textContent = value;
        if (todayEnergyLabel) todayEnergyLabel.textContent = `Today's Energy Usage (${unit})`;
    }
}

// Update appliance table from server data
function updateApplianceTable(appliances) {
    const tbody = document.getElementById('appliance-table-body');
    if (!tbody || !appliances) return;

    tbody.innerHTML = '';

    appliances.forEach(appliance => {
        const row = document.createElement('tr');
        // Ensure all values are properly formatted and handle missing fields
        // Current is in mA from backend, display as-is
        const current = parseFloat(appliance.current) || 0;
        const voltage = parseFloat(appliance.voltage) || 120.0;
        const power = parseFloat(appliance.power) || 0;
        const status = appliance.status || 'Off';

        row.innerHTML = `
            <td>${appliance.name || 'Unknown'}</td>
            <td>${appliance.circuit || 'N/A'}</td>
            <td>${current.toFixed(1)}</td>
            <td>${voltage.toFixed(1)}</td>
            <td>${power.toFixed(0)}</td>
            <td><span class="status-badge status-${status.toLowerCase()}">${status}</span></td>
        `;
        tbody.appendChild(row);
    });
}


// Populate Appliance Table
function populateApplianceTable() {
    const tbody = document.getElementById('appliance-table-body');
    tbody.innerHTML = '';

    sampleAppliances.forEach(appliance => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${appliance.name}</td>
            <td>${appliance.circuit}</td>
            <td>${appliance.current.toFixed(1)}</td>
            <td>${appliance.voltage.toFixed(1)}</td>
            <td>${appliance.power}</td>
            <td><span class="status-badge status-${appliance.status.toLowerCase()}">${appliance.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Populate Voltage Cards
function populateVoltageCards() {
    const container = document.getElementById('voltage-cards');
    container.innerHTML = '';

    sampleAppliances.forEach(appliance => {
        const card = document.createElement('div');
        card.className = 'appliance-detail-card';

        let indicatorClass = 'indicator-normal';
        let indicatorText = 'Normal';
        if (appliance.voltage < 115) {
            indicatorClass = 'indicator-low';
            indicatorText = 'Low';
        } else if (appliance.voltage > 125) {
            indicatorClass = 'indicator-high';
            indicatorText = 'High';
        }

        card.innerHTML = `
            <h4>${appliance.name}</h4>
            <div class="voltage-value">${appliance.voltage.toFixed(1)} V</div>
            <div class="voltage-indicator">
                <span class="indicator-badge ${indicatorClass}">${indicatorText}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// Populate Current Cards
function populateCurrentCards() {
    const container = document.getElementById('current-cards');
    container.innerHTML = '';

    // Find max current for relative scaling
    const maxCurrent = Math.max(...sampleAppliances.map(a => a.current));

    sampleAppliances.forEach(appliance => {
        const card = document.createElement('div');
        card.className = 'appliance-detail-card';

        const percentage = maxCurrent > 0 ? (appliance.current / maxCurrent) * 100 : 0;

        card.innerHTML = `
            <h4>${appliance.name}</h4>
            <div class="current-value">${appliance.current.toFixed(1)} A</div>
            <div class="current-bar">
                <div class="current-progress">
                    <div class="current-progress-bar" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Populate Active Alerts
function populateActiveAlerts() {
    const container = document.getElementById('active-alerts-list');
    container.innerHTML = '';

    sampleAlerts.forEach(alert => {
        const alertItem = document.createElement('div');
        alertItem.className = `alert-item alert-${alert.severity}`;

        alertItem.innerHTML = `
            <div class="alert-content">
                <div class="alert-type">${alert.type}</div>
                <div class="alert-appliance">${alert.appliance}</div>
                <div class="alert-time">${alert.time}</div>
                <div class="alert-description">${alert.description}</div>
            </div>
            <div class="alert-severity-badge severity-${alert.severity}">${alert.severity.toUpperCase()}</div>
        `;
        container.appendChild(alertItem);
    });
}

// Populate Alert History
function populateAlertHistory() {
    const tbody = document.getElementById('alert-history-body');
    tbody.innerHTML = '';

    sampleAlertHistory.forEach(alert => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${alert.time}</td>
            <td>${alert.type}</td>
            <td>${alert.appliance}</td>
            <td>${alert.description}</td>
            <td><span class="alert-severity-badge severity-${alert.severity}">${alert.severity.toUpperCase()}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Tab Switching
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// Search Functionality
function initSearch() {
    const searchInput = document.getElementById('appliance-search');
    const tableBody = document.getElementById('appliance-table-body');

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

// Smooth Scrolling
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80; // Account for fixed navbar
                const targetPosition = target.offsetTop - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Close mobile menu if open
                const navMenu = document.getElementById('nav-menu');
                navMenu.classList.remove('active');
            }
        });
    });
}

// Mobile Navigation Toggle
function initMobileNav() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
}

// Update Dashboard Values (simulate real-time updates)
// Note: This is disabled when ESP32 data is active - Socket.io updates handle real data
let dashboardSimulationInterval = null;

function updateDashboardValues() {
    // Only simulate if we're not receiving real data from Socket.io
    // Real updates come via Socket.io 'dashboard-update' event
    // This function is kept for initial display/fallback only

    // Clear any existing interval
    if (dashboardSimulationInterval) {
        clearInterval(dashboardSimulationInterval);
        dashboardSimulationInterval = null;
    }

    // Don't run simulation - Socket.io will handle all updates
    // This prevents interference with real ESP32 data
}

// Navbar Scroll Effect
function initNavbarScroll() {
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
            navbar.style.background = 'rgba(26, 31, 58, 0.98)';
            navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
        } else {
            navbar.style.background = 'rgba(26, 31, 58, 0.95)';
            navbar.style.boxShadow = 'none';
        }

        lastScroll = currentScroll;
    });
}

// Back to Top Button
function initBackToTop() {
    const backToTopBtn = document.getElementById('back-to-top');

    if (!backToTopBtn) return; // Exit if button doesn't exist

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Sortable Tables
function initSortableTables() {
    const headers = document.querySelectorAll('th.sortable');
    let currentSort = { column: null, direction: 'asc' };

    headers.forEach(header => {
        const sortIcon = header.querySelector('.sort-icon');
        if (!sortIcon) return; // Skip if sort icon doesn't exist

        header.addEventListener('click', () => {
            const column = header.getAttribute('data-sort');
            if (!column) return; // Skip if no data-sort attribute

            const direction = currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc';

            // Reset icons
            headers.forEach(h => {
                h.classList.remove('asc', 'desc');
                const icon = h.querySelector('.sort-icon');
                if (icon) icon.textContent = '↕';
            });

            // Update current header
            header.classList.add(direction);
            if (sortIcon) {
                sortIcon.textContent = direction === 'asc' ? '↑' : '↓';
            }

            currentSort = { column, direction };
            sortApplianceTable(column, direction);
        });
    });
}

function sortApplianceTable(column, direction) {
    const tbody = document.getElementById('appliance-table-body');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    const sortedRows = rows.sort((a, b) => {
        let aVal, bVal;

        // Extract value based on column
        switch (column) {
            case 'name':
                aVal = a.children[0].textContent;
                bVal = b.children[0].textContent;
                break;
            case 'circuit':
                aVal = a.children[1].textContent;
                bVal = b.children[1].textContent;
                break;
            case 'current':
                aVal = parseFloat(a.children[2].textContent);
                bVal = parseFloat(b.children[2].textContent);
                break;
            case 'voltage':
                aVal = parseFloat(a.children[3].textContent);
                bVal = parseFloat(b.children[3].textContent);
                break;
            case 'power':
                aVal = parseFloat(a.children[4].textContent);
                bVal = parseFloat(b.children[4].textContent);
                break;
            case 'status':
                aVal = a.children[5].textContent.trim();
                bVal = b.children[5].textContent.trim();
                break;
            default:
                return 0;
        }

        if (direction === 'asc') {
            if (aVal > bVal) return 1;
            if (aVal < bVal) return -1;
            return 0; // Equal values
        } else {
            if (aVal < bVal) return 1;
            if (aVal > bVal) return -1;
            return 0; // Equal values
        }
    });

    tbody.innerHTML = '';
    sortedRows.forEach(row => tbody.appendChild(row));
}

// ScrollSpy
function initScrollSpy() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= (sectionTop - 150)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('active');
            }
        });
    });
}

// Hero Parallax
function initParallax() {
    const hero = document.querySelector('.hero');
    if (!hero) return; // Exit if hero section doesn't exist

    const elements = document.querySelectorAll('.leaf, .wave, .sun');
    if (elements.length === 0) return; // Exit if no parallax elements found

    hero.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        elements.forEach((el, index) => {
            const speed = (index + 1) * 2;
            const xOffset = (x - 0.5) * speed * 10;
            const yOffset = (y - 0.5) * speed * 10;
            el.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        });
    });
}

// ============================================
// Profile Management Functions
// ============================================

/**
 * Initialize profile form
 */
function initProfileForm() {
    const form = document.getElementById('profile-form');
    const resetBtn = document.getElementById('reset-profile-btn');

    if (!form) return;

    // Load existing profile into form
    loadProfileIntoForm();

    // Handle form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProfileFromForm();
    });

    // Handle reset button
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Reset button clicked'); // Debug log
            if (confirm('Reset profile to defaults? This will clear your current settings.')) {
                console.log('User confirmed reset'); // Debug log
                resetProfile();
            }
        });
    } else {
        console.error('Reset button not found!'); // Debug log
    }
}

/**
 * Load profile data into form
 */
function loadProfileIntoForm() {
    const profile = window.profileService?.loadProfile();
    if (!profile) return;

    // Set form values
    const householdType = document.getElementById('household-type');
    const occupants = document.getElementById('occupants');
    const heatingType = document.getElementById('heating-type');
    const hasAC = document.getElementById('has-ac');
    const hasEVCharger = document.getElementById('has-ev-charger');
    const hasElectricWaterHeater = document.getElementById('has-electric-water-heater');
    const goal = document.getElementById('goal');
    const notificationPreference = document.getElementById('notification-preference');

    if (householdType) householdType.value = profile.householdType || '';
    if (occupants) occupants.value = profile.occupants || '';
    if (heatingType) heatingType.value = profile.heatingType || '';
    if (hasAC) hasAC.checked = profile.hasAC || false;
    if (hasEVCharger) hasEVCharger.checked = profile.hasEVCharger || false;
    if (hasElectricWaterHeater) hasElectricWaterHeater.checked = profile.hasElectricWaterHeater || false;
    if (goal) goal.value = profile.goal || '';
    if (notificationPreference) notificationPreference.value = profile.notificationPreference || 'in_app';
}

/**
 * Save profile from form
 */
function saveProfileFromForm() {
    const profile = {
        householdType: document.getElementById('household-type')?.value || '',
        occupants: parseInt(document.getElementById('occupants')?.value) || 1,
        heatingType: document.getElementById('heating-type')?.value || '',
        hasAC: document.getElementById('has-ac')?.checked || false,
        hasEVCharger: document.getElementById('has-ev-charger')?.checked || false,
        hasElectricWaterHeater: document.getElementById('has-electric-water-heater')?.checked || false,
        goal: document.getElementById('goal')?.value || '',
        notificationPreference: document.getElementById('notification-preference')?.value || 'in_app'
    };

    // Validate
    if (!profile.householdType || !profile.heatingType || !profile.goal || !profile.notificationPreference) {
        showProfileMessage('Please fill in all required fields.', 'error');
        return;
    }

    if (profile.occupants < 1) {
        showProfileMessage('Number of occupants must be at least 1.', 'error');
        return;
    }

    // Save profile
    const success = window.profileService?.saveProfile(profile);

    if (success) {
        showProfileMessage('Profile saved successfully! Your insights will be updated.', 'success');
        // Update insights display
        updatePersonalizedInsights();
        // Scroll to insights section after a short delay
        setTimeout(() => {
            document.getElementById('insights')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 1000);
    } else {
        showProfileMessage('Error saving profile. Please try again.', 'error');
    }
}

/**
 * Reset profile to defaults
 */
function resetProfile() {
    console.log('resetProfile() called'); // Debug log

    try {
        // Get form element and reset it
        const form = document.getElementById('profile-form');
        if (form) {
            form.reset();
            console.log('Form reset called'); // Debug log
        }

        // Manually reset each field to ensure everything is cleared
        const householdType = document.getElementById('household-type');
        const occupants = document.getElementById('occupants');
        const heatingType = document.getElementById('heating-type');
        const hasAC = document.getElementById('has-ac');
        const hasEVCharger = document.getElementById('has-ev-charger');
        const hasElectricWaterHeater = document.getElementById('has-electric-water-heater');
        const goal = document.getElementById('goal');
        const notificationPreference = document.getElementById('notification-preference');

        // Reset select dropdowns
        if (householdType) {
            householdType.selectedIndex = 0;
            householdType.value = '';
            console.log('Household type reset'); // Debug log
        }

        if (occupants) {
            occupants.value = '';
            console.log('Occupants reset'); // Debug log
        }

        if (heatingType) {
            heatingType.selectedIndex = 0;
            heatingType.value = '';
            console.log('Heating type reset'); // Debug log
        }

        // Reset checkboxes
        if (hasAC) {
            hasAC.checked = false;
            console.log('AC checkbox reset'); // Debug log
        }
        if (hasEVCharger) {
            hasEVCharger.checked = false;
            console.log('EV charger checkbox reset'); // Debug log
        }
        if (hasElectricWaterHeater) {
            hasElectricWaterHeater.checked = false;
            console.log('Water heater checkbox reset'); // Debug log
        }

        // Reset other selects
        if (goal) {
            goal.selectedIndex = 0;
            goal.value = '';
            console.log('Goal reset'); // Debug log
        }

        if (notificationPreference) {
            notificationPreference.value = 'in_app';
            console.log('Notification preference reset'); // Debug log
        }

        // Clear localStorage
        localStorage.removeItem('smartMeter_userProfile');
        console.log('localStorage cleared'); // Debug log

        // Save default profile
        const defaultProfile = window.profileService?.getDefaultProfile();
        if (defaultProfile) {
            window.profileService?.saveProfile(defaultProfile);
            console.log('Default profile saved'); // Debug log
        }

        showProfileMessage('Profile reset to defaults. All fields have been cleared.', 'success');
        updatePersonalizedInsights();

        console.log('Reset complete'); // Debug log
    } catch (error) {
        console.error('Error resetting profile:', error);
        showProfileMessage('Error resetting profile. Please try again.', 'error');
    }
}

/**
 * Show profile save message
 */
function showProfileMessage(message, type) {
    const messageEl = document.getElementById('profile-save-message');
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.className = `save-message ${type}`;
    messageEl.style.display = 'block';

    // Hide after 5 seconds
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

/**
 * Update personalized insights display
 */
function updatePersonalizedInsights() {
    const tipsCard = document.getElementById('personalized-tips-card');
    const tipsContent = document.getElementById('personalized-tips-content');

    if (!tipsCard || !tipsContent) return;

    // Get profile and usage data
    const profile = window.profileService?.getProfile();
    const usageData = window.insightsGenerator?.getMockUsageData();

    // Generate insights
    const insights = window.insightsGenerator?.generateInsights(usageData, profile) || [];

    if (insights.length === 0) {
        tipsCard.style.display = 'none';
        return;
    }

    // Display insights
    tipsCard.style.display = 'block';

    // Check if profile is incomplete
    if (!profile) {
        tipsContent.innerHTML = `
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                Set up your profile to get personalized energy-saving tips tailored to your household.
            </p>
            <a href="#profile" class="btn btn-primary" style="display: inline-block; margin-top: 1rem;">Set Up Profile</a>
        `;
        return;
    }

    // Create tips list
    const tipsList = document.createElement('ul');
    tipsList.className = 'tips-list';

    insights.forEach(insight => {
        const li = document.createElement('li');
        li.textContent = insight;
        tipsList.appendChild(li);
    });

    tipsContent.innerHTML = '';
    tipsContent.appendChild(tipsList);
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    populateApplianceTable();
    populateVoltageCards();
    populateCurrentCards();
    populateActiveAlerts();
    populateAlertHistory();
    initTabs();
    initSearch();
    initSmoothScroll();
    initMobileNav();
    updateDashboardValues();
    initNavbarScroll();

    // New UI/UX Features
    initBackToTop();
    initSortableTables();
    initScrollSpy();
    initParallax();

    // Initialize connection status
    updateConnectionStatus();

    // Profile and Insights
    initProfileForm();
    updatePersonalizedInsights();
});

