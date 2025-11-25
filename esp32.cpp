#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);  // Change address if needed (0x3F is common alternative)

// Only using components you have
const int CURRENT_SENSOR_PIN = 34;    // ESP32 analog pin for current sensor
const int MODE_BUTTON = 4;            // ESP32 digital pin for button (you can change this)

// Calibration for ACS712 current sensor
const float CURRENT_CALIBRATION = 0.0264; 
const float ASSUMED_VOLTAGE = 120.0;     // Standard household voltage

// Energy calculation variables
float currentRMS = 0;
float realPower = 0;
float energyConsumed = 0;              // Watt-hours
unsigned long lastCalculationTime = 0;
unsigned long lastDisplayUpdate = 0;

// Data aggregation
float powerReadings[60];               // 1-minute buffer
int readingIndex = 0;
unsigned long lastAggregation = 0;

// Alert thresholds
const float OVER_CURRENT_THRESHOLD = 5.0;    // Amps
const float POWER_SPIKE_THRESHOLD = 1200.0;  // Watts

// Alert tracking
bool alertActive = false;
String alertMessage = "";

// Display modes
int displayMode = 0;                   // 0: Real-time, 1: Summary, 2: Alerts
bool lastButtonState = HIGH;

void setup() {
  Serial.begin(115200);                // Faster serial for ESP32
  
  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Energy Meter");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");
  
  // Initialize button pin
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
  
  // Send data to serial every 5 seconds
  if (currentTime % 5000 == 0) {
    sendDataToSerial();
  }
}

void readSensors() {
  // Read multiple samples for accuracy
  float sum = 0;
  int samples = 100;
  
  for (int i = 0; i < samples; i++) {
    int analogValue = analogRead(CURRENT_SENSOR_PIN);
    float voltage = (analogValue / 4095.0) * 3.3;  // ESP32 has 12-bit ADC (0-4095)
    float current = (voltage - 1.65) / 0.185;      // ACS712: 1.65V = 0A, 185mV per Amp
    sum += current * current;  // Square for RMS calculation
    delay(1);
  }
  
  // Calculate RMS current
  currentRMS = sqrt(sum / samples);
  
  // Noise filter
  if (currentRMS < 0.02) currentRMS = 0;
}

void calculatePowerParameters() {
  // Calculate power using assumed voltage and measured current
  realPower = ASSUMED_VOLTAGE * currentRMS;
  
  // Calculate energy (Watt-hours) - divide by 3600 for watt-hours per second
  energyConsumed += realPower / 3600.0;
  
  // Store in ring buffer for aggregation
  powerReadings[readingIndex] = realPower;
  readingIndex = (readingIndex + 1) % 60;
}

void checkAlerts() {
  alertActive = false;
  alertMessage = "";
  
  if (currentRMS > OVER_CURRENT_THRESHOLD) {
    alertMessage = "HIGH CURRENT!";
    alertActive = true;
    Serial.println("ALERT: Over Current! " + String(currentRMS, 1) + "A");
  }
  
  if (realPower > POWER_SPIKE_THRESHOLD) {
    alertMessage = "POWER SPIKE!";
    alertActive = true;
    Serial.println("ALERT: Power Spike! " + String(realPower, 0) + "W");
  }
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
  
  Serial.print("1-min Summary - Avg: ");
  Serial.print(avgPower);
  Serial.print("W, Max: ");
  Serial.print(maxPower);
  Serial.print("W, Total: ");
  Serial.print(energyConsumed);
  Serial.println("Wh");
}

void updateDisplay() {
  lcd.clear();
  
  switch (displayMode) {
    case 0: // Real-time data
      lcd.setCursor(0, 0);
      lcd.print("Curr:");
      lcd.print(currentRMS, 2);
      lcd.print("A");
      
      lcd.setCursor(0, 1);
      lcd.print("Power:");
      lcd.print(realPower, 0);
      lcd.print("W");
      break;
      
    case 1: // Energy summary
      lcd.setCursor(0, 0);
      lcd.print("Energy:");
      lcd.print(energyConsumed, 1);
      lcd.print("Wh");
      
      lcd.setCursor(0, 1);
      lcd.print("Avg:");
      lcd.print(calculateAveragePower(), 0);
      lcd.print("W Max:");
      lcd.print(findMaxPower(), 0);
      lcd.print("W");
      break;
      
    case 2: // Alert status
      lcd.setCursor(0, 0);
      lcd.print("Status:");
      lcd.setCursor(0, 1);
      if (alertActive) {
        lcd.print(alertMessage);
      } else {
        lcd.print("System Normal");
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

void sendDataToSerial() {
  // Send data in JSON format for potential web integration
  Serial.print("{\"current\":");
  Serial.print(currentRMS, 3);
  Serial.print(",\"power\":");
  Serial.print(realPower, 1);
  Serial.print(",\"energy\":");
  Serial.print(energyConsumed, 3);
  Serial.print(",\"alert\":");
  Serial.print(alertActive ? "true" : "false");
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

float findMaxPower() {
  float maxPower = 0;
  for (int i = 0; i < 60; i++) {
    if (powerReadings[i] > maxPower) {
      maxPower = powerReadings[i];
    }
  }
  return maxPower;
}
