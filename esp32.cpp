#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <math.h>

// ================= LCD & PINS =================
LiquidCrystal_I2C lcd(0x27, 16, 2);  // change to 0x3F if your LCD uses that

const int CURRENT_SENSOR_PIN = 34;   // ACS712 OUT to ESP32 ADC
const int MODE_BUTTON        = 4;    // push button to change LCD modes

// ============== ACS712 30A CONSTANTS ==========
const float ADC_VREF        = 3.3;       // ESP32 ADC reference
const int   ADC_MAX         = 4095;      // 12-bit ADC
const float ACS_SENSITIVITY = 0.066;     // 66 mV/A for ACS712 30A

// ============== POWER / ENERGY CONSTANTS ======
const float ASSUMED_VOLTAGE = 120.0;     // for now, assume 120 V mains

// ============== RUNTIME VARIABLES =============
float currentRMS       = 0.0;
float realPower        = 0.0;
float energyConsumed   = 0.0;             // Wh

unsigned long lastCalculationTime = 0;
unsigned long lastDisplayUpdate   = 0;
unsigned long lastAggregation     = 0;

// Ring buffer for 1-minute power data (60 x 1s samples)
float powerReadings[60];
int   readingIndex = 0;

// Alert thresholds
const float OVER_CURRENT_THRESHOLD = 5.0;    // Amps
const float POWER_SPIKE_THRESHOLD  = 1200.0; // Watts

// Alert state
bool   alertActive  = false;
String alertMessage = "";

// Display modes: 0 = real-time, 1 = summary, 2 = alerts
int  displayMode      = 0;
bool lastButtonState  = HIGH;

// ACS712 calibration offset (ADC counts at 0A)
int currentOffset = 0;

// ========= FUNCTION PROTOTYPES =========
void calibrateCurrentSensor();
void readSensors();
void calculatePowerParameters();
void checkAlerts();
void aggregateData();
void updateDisplay();
void checkModeButton();
void sendDataToSerial();
float calculateAveragePower();
float findMaxPower();

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(1000);

  // LCD init
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Energy Meter");
  lcd.setCursor(0, 1);
  lcd.print("Calibrating...");

  // Button
  pinMode(MODE_BUTTON, INPUT_PULLUP);

  // Init buffer
  for (int i = 0; i < 60; i++) {
    powerReadings[i] = 0.0;
  }

  // Calibrate ACS712 with NO LOAD connected
  calibrateCurrentSensor();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Smart Energy Meter");
  lcd.setCursor(0, 1);
  lcd.print("Ready");
  delay(1500);
  lcd.clear();
}

// ================= LOOP =================
void loop() {
  unsigned long currentTime = millis();

  // 1) Always read sensors (currentRMS)
  readSensors();

  // 2) Every 1 s: update power & energy, alerts, and ring buffer
  if (currentTime - lastCalculationTime >= 1000) {
    calculatePowerParameters();
    checkAlerts();

    powerReadings[readingIndex] = realPower;
    readingIndex = (readingIndex + 1) % 60;

    lastCalculationTime = currentTime;
  }

  // 3) Every 60 s: print a 1-min summary on Serial
  if (currentTime - lastAggregation >= 60000) {
    aggregateData();
    lastAggregation = currentTime;
  }

  // 4) Every 500 ms: refresh LCD display
  if (currentTime - lastDisplayUpdate >= 500) {
    updateDisplay();
    lastDisplayUpdate = currentTime;
  }

  // 5) Check mode button
  checkModeButton();

  // 6) Every ~5 s: send JSON-style data on Serial
  if ((currentTime / 5000) != ((currentTime - 50) / 5000)) {
    sendDataToSerial();
  }
}

// ============ SENSOR & POWER LOGIC ============

// Calibrate ACS712 zero-current offset
void calibrateCurrentSensor() {
  const int N_CAL = 2000;
  long sum = 0;

  Serial.println("Calibrating current sensor... keep load disconnected.");
  delay(500);

  for (int i = 0; i < N_CAL; i++) {
    int raw = analogRead(CURRENT_SENSOR_PIN);
    sum += raw;
    delay(2);
  }

  currentOffset = sum / N_CAL;

  Serial.print("Calibration done. Current offset = ");
  Serial.println(currentOffset);
  Serial.println("Now you can connect a load through the ACS712.");
}

// Read ACS712 and compute RMS current (Amps)
void readSensors() {
  const int N_SAMPLES = 400;
  double sumI2 = 0;

  for (int i = 0; i < N_SAMPLES; i++) {
    int raw = analogRead(CURRENT_SENSOR_PIN);

    float sensorVolts = (raw - currentOffset) * (ADC_VREF / ADC_MAX);
    float currentA    = sensorVolts / ACS_SENSITIVITY;

    // Deadband: ignore small noise on 30A sensor
    if (fabs(currentA) < 0.30) {
      currentA = 0.0;
    }

    sumI2 += (double)currentA * (double)currentA;
    delay(2);
  }

  currentRMS = sqrt(sumI2 / N_SAMPLES);
}

// Compute real power and accumulate energy
void calculatePowerParameters() {
  realPower = ASSUMED_VOLTAGE * currentRMS;          // Watts
  energyConsumed += realPower / 3600.0;              // Wh (power * time[s] / 3600)
}

// Check for alert conditions
void checkAlerts() {
  alertActive  = false;
  alertMessage = "";

  if (currentRMS > OVER_CURRENT_THRESHOLD) {
    alertActive  = true;
    alertMessage = "HIGH CURRENT!";
    Serial.println("ALERT: Over Current! " + String(currentRMS, 1) + "A");
  }

  if (realPower > POWER_SPIKE_THRESHOLD) {
    alertActive  = true;
    alertMessage = "POWER SPIKE!";
    Serial.println("ALERT: Power Spike! " + String(realPower, 0) + "W");
  }
}

// 1-minute summary on Serial
void aggregateData() {
  float sum = 0;
  float maxPower = 0;
  int valid = 0;

  for (int i = 0; i < 60; i++) {
    if (powerReadings[i] > 0) {
      sum += powerReadings[i];
      if (powerReadings[i] > maxPower) maxPower = powerReadings[i];
      valid++;
    }
  }

  float avgPower = valid > 0 ? sum / valid : 0;

  Serial.print("1-min Summary - Avg: ");
  Serial.print(avgPower);
  Serial.print(" W, Max: ");
  Serial.print(maxPower);
  Serial.print(" W, Total: ");
  Serial.print(energyConsumed);
  Serial.println(" Wh");
}

// ================= LCD & UI ===================

void updateDisplay() {
  lcd.clear();

  switch (displayMode) {
    case 0: // Real-time
      lcd.setCursor(0, 0);
      lcd.print("I:");
      lcd.print(currentRMS, 2);
      lcd.print("A ");

      lcd.setCursor(0, 1);
      lcd.print("P:");
      lcd.print(realPower, 0);
      lcd.print("W ");
      break;

    case 1: // Energy summary
      lcd.setCursor(0, 0);
      lcd.print("E:");
      lcd.print(energyConsumed, 1);
      lcd.print("Wh");

      lcd.setCursor(0, 1);
      lcd.print("Avg:");
      lcd.print(calculateAveragePower(), 0);
      lcd.print(" Max:");
      lcd.print(findMaxPower(), 0);
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
  bool currentState = digitalRead(MODE_BUTTON);

  if (currentState == LOW && lastButtonState == HIGH) {
    displayMode = (displayMode + 1) % 3;  // cycle 0 → 1 → 2 → 0
    delay(200); // debounce
  }

  lastButtonState = currentState;
}

// ============== SERIAL JSON OUTPUT =============

void sendDataToSerial() {
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

// ============== HELPERS ========================

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
  float maxP = 0;
  for (int i = 0; i < 60; i++) {
    if (powerReadings[i] > maxP) {
      maxP = powerReadings[i];
    }
  }
  return maxP;
}
