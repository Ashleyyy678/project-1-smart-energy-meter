#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

// Sensor pins
const int CURRENT_SENSOR_PIN = A0;
const int VOLTAGE_SENSOR_PIN = A1;
const int ALERT_LED = 2;
const int MODE_BUTTON = 3;

// Calibration constants
const float VOLTAGE_CALIBRATION = 0.0746; // Adjust based on voltage divider
const float CURRENT_CALIBRATION = 0.0264; // Adjust for ACS712 simulation
const int ADC_MAX = 1023;
const float SUPPLY_VOLTAGE = 5.0;

// Energy calculation variables
float voltageRMS = 0;
float currentRMS = 0;
float realPower = 0;
float apparentPower = 0;
float energyConsumed = 0; // Watt-hours
unsigned long lastCalculationTime = 0;
unsigned long lastDisplayUpdate = 0;

// Data aggregation
float powerReadings[60]; // 1-minute buffer
int readingIndex = 0;
unsigned long lastAggregation = 0;

// Alert thresholds
const float OVER_VOLTAGE_THRESHOLD = 250.0; // Volts
const float OVER_CURRENT_THRESHOLD = 5.0;   // Amps
const float POWER_SPIKE_THRESHOLD = 1200.0; // Watts

// Display modes
int displayMode = 0; // 0: Real-time, 1: Summary, 2: Alerts
bool lastButtonState = HIGH;

void setup() {
  Serial.begin(9600);
  
  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("CS410 Smart Meter");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");
  
  // Initialize pins
  pinMode(ALERT_LED, OUTPUT);
  pinMode(MODE_BUTTON, INPUT_PULLUP);
  
  // Initialize power readings array
  for (int i = 0; i < 60; i++) {
    powerReadings[i] = 0;
  }
  
  delay(2000);
  lcd.clear();
}

void loop() {
  unsigned long currentTime = millis();
  
  // Read sensors every cycle
  readSensors();
  
  // Calculate power and energy every second
  if (currentTime - lastCalculationTime >= 1000) {
    calculatePowerParameters();
    checkAlerts();
    lastCalculationTime = currentTime;
  }
  
  // Aggregate data every minute
  if (currentTime - lastAggregation >= 60000) {
    aggregateData();
    lastAggregation = currentTime;
  }
  
  // Update display every 500ms
  if (currentTime - lastDisplayUpdate >= 500) {
    updateDisplay();
    lastDisplayUpdate = currentTime;
  }
  
  // Check for mode button press
  checkModeButton();
  
  // Simulate data transmission (serial output)
  if (currentTime % 5000 == 0) {
    sendDataToCloud();
  }
}

void readSensors() {
  // Simulate voltage reading (0-300V scaled to 0-5V)
  int voltageRaw = analogRead(VOLTAGE_SENSOR_PIN);
  voltageRMS = (voltageRaw * (SUPPLY_VOLTAGE / ADC_MAX)) / VOLTAGE_CALIBRATION;
  
  // Simulate current reading (ACS712: 2.5V = 0A, sensitivity 185mV/A)
  int currentRaw = analogRead(CURRENT_SENSOR_PIN);
  float voltageOffset = (currentRaw * (SUPPLY_VOLTAGE / ADC_MAX)) - (SUPPLY_VOLTAGE / 2);
  currentRMS = voltageOffset / CURRENT_CALIBRATION;
  if (currentRMS < 0.1) currentRMS = 0; // Noise filter
}

void calculatePowerParameters() {
  // Calculate real power (simplified - assumes resistive load)
  realPower = voltageRMS * currentRMS;
  apparentPower = realPower; // Simplified for simulation
  
  // Calculate energy (Watt-hours)
  energyConsumed += realPower / 3600.0;
  
  // Store in ring buffer for aggregation
  powerReadings[readingIndex] = realPower;
  readingIndex = (readingIndex + 1) % 60;
}

void checkAlerts() {
  bool alert = false;
  
  if (voltageRMS > OVER_VOLTAGE_THRESHOLD) {
    Serial.println("ALERT: Over Voltage!");
    alert = true;
  }
  
  if (currentRMS > OVER_CURRENT_THRESHOLD) {
    Serial.println("ALERT: Over Current!");
    alert = true;
  }
  
  if (realPower > POWER_SPIKE_THRESHOLD) {
    Serial.println("ALERT: Power Spike Detected!");
    alert = true;
  }
  
  digitalWrite(ALERT_LED, alert ? HIGH : LOW);
}

void aggregateData() {
  float sum = 0;
  float maxPower = 0;
  int validReadings = 0;
  
  for (int i = 0; i < 60; i++) {
    if (powerReadings[i] > 0) {
      sum += powerReadings[i];
      if (powerReadings[i] > maxPower) {
        maxPower = powerReadings[i];
      }
      validReadings++;
    }
  }
  
  float avgPower = validReadings > 0 ? sum / validReadings : 0;
  
  Serial.print("1-min Aggregation - Avg: ");
  Serial.print(avgPower);
  Serial.print("W, Max: ");
  Serial.print(maxPower);
  Serial.print("W, Energy: ");
  Serial.print(energyConsumed);
  Serial.println("Wh");
}

void updateDisplay() {
  lcd.clear();
  
  switch (displayMode) {
    case 0: // Real-time data
      lcd.setCursor(0, 0);
      lcd.print("V:");
      lcd.print(voltageRMS, 1);
      lcd.print("V I:");
      lcd.print(currentRMS, 2);
      lcd.print("A");
      
      lcd.setCursor(0, 1);
      lcd.print("P:");
      lcd.print(realPower, 1);
      lcd.print("W E:");
      lcd.print(energyConsumed, 1);
      lcd.print("Wh");
      break;
      
    case 1: // Summary data
      lcd.setCursor(0, 0);
      lcd.print("Today: ");
      lcd.print(energyConsumed, 1);
      lcd.print("Wh");
      
      lcd.setCursor(0, 1);
      lcd.print("Avg P: ");
      lcd.print(calculateAveragePower(), 1);
      lcd.print("W");
      break;
      
    case 2: // Alert status
      lcd.setCursor(0, 0);
      lcd.print("Alert Status:");
      lcd.setCursor(0, 1);
      if (digitalRead(ALERT_LED)) {
        lcd.print("ACTIVE - Check!");
      } else {
        lcd.print("All Systems OK");
      }
      break;
  }
}

void checkModeButton() {
  bool currentButtonState = digitalRead(MODE_BUTTON);
  
  if (currentButtonState == LOW && lastButtonState == HIGH) {
    // Button pressed
    displayMode = (displayMode + 1) % 3;
    delay(200); // Debounce
  }
  
  lastButtonState = currentButtonState;
}

void sendDataToCloud() {
  // Simulate MQTT data transmission
  Serial.print("MQTT: {");
  Serial.print("\"voltage\":");
  Serial.print(voltageRMS, 2);
  Serial.print(",\"current\":");
  Serial.print(currentRMS, 3);
  Serial.print(",\"power\":");
  Serial.print(realPower, 2);
  Serial.print(",\"energy\":");
  Serial.print(energyConsumed, 3);
  Serial.println("}");
}

float calculateAveragePower() {
  float sum = 0;
  int count = 0;
  
  for (int i = 0; i < 60; i++) {
    if (powerReadings[i] > 0) {
      sum += powerReadings[i];
      count++;
    }
  }
  
  return count > 0 ? sum / count : 0;
}