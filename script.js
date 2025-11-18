// Sample Data
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
function updateDashboardValues() {
    // Simulate slight fluctuations in values
    const totalPower = document.getElementById('total-power');
    const totalCurrent = document.getElementById('total-current');
    const lineVoltage = document.getElementById('line-voltage');
    const todayEnergy = document.getElementById('today-energy');

    setInterval(() => {
        if (totalPower) {
            const currentValue = parseFloat(totalPower.textContent);
            totalPower.textContent = (currentValue + (Math.random() - 0.5) * 0.1).toFixed(2);
        }
        if (totalCurrent) {
            const currentValue = parseFloat(totalCurrent.textContent);
            totalCurrent.textContent = (currentValue + (Math.random() - 0.5) * 0.2).toFixed(1);
        }
        if (lineVoltage) {
            const currentValue = parseFloat(lineVoltage.textContent);
            lineVoltage.textContent = (currentValue + (Math.random() - 0.5) * 0.5).toFixed(1);
        }
    }, 3000); // Update every 3 seconds
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
});


