#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <math.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>  // For HTTPS support (Render deployment)
#include "esp_wpa2.h"  // For WPA2-Enterprise authentication (school WiFi)

// ================= LCD & PINS =================
LiquidCrystal_I2C lcd(0x27, 16, 2);  // change to 0x3F if your LCD uses that

const int CURRENT_SENSOR_PIN = 34;   // ACS712 OUT to ESP32 ADC
const int VOLTAGE_SENSOR_PIN = 35;   // Voltage sensor S (signal) pin → ESP32 GPIO 35
const int MODE_BUTTON        = 4;    // push button to change LCD modes

// ================= WIFI CONFIGURATION =================
// Primary WiFi Setup (Basic WPA2)
const char* PRIMARY_SSID = "Pratham";
const char* PRIMARY_PASSWORD = "pratham2505";

// School WiFi Setup (WPA2-Enterprise) - eduroam network (backup)
const char* SCHOOL_SSID = "eduroam";
const char* SCHOOL_USERNAME = "raghav.kalani001";
const char* SCHOOL_PASSWORD = "Rajshree#0204142219";

// WiFi connection priority: PRIMARY_FIRST tries primary WiFi, then school if primary fails
#define WIFI_PRIORITY_PRIMARY_FIRST true

// Backend server URL (Render deployment)
const char* SERVER_URL = "https://smart-energy-meter-f2vv.onrender.com/readings";
const char* DEVICE_ID = "esp32_1";

// WiFi connection state
bool wifiConnected = false;
unsigned long lastWiFiAttempt = 0;
const unsigned long WIFI_RECONNECT_INTERVAL = 30000; // Try to reconnect every 30 seconds

// ============== ACS712 30A CONSTANTS ==========
const float ADC_VREF        = 3.3;       // ESP32 ADC reference
const int   ADC_MAX         = 4095;      // 12-bit ADC
const float ACS_SENSITIVITY = 0.066;     // 66 mV/A for ACS712 30A

// ============== VOLTAGE SENSOR CONSTANTS ==========
// Passive voltage divider module (resistor divider board)
// Module wiring: GND → ESP32 GND, S (signal) → GPIO 35, NC pin → not connected
// Module does NOT require VCC - it's a passive divider circuit
// Divider scales input voltage down by this ratio (typically ~1/5 for common modules)
// ESP32 ADC max is 3.3V, so safe input range depends on divider ratio
const float VOLTAGE_DIVIDER_RATIO = 5.0;    // Input voltage / Output voltage ratio (adjust if needed)
const float VOLTAGE_CAL_OFFSET = 0.0;       // Calibration offset (add/subtract to correct readings)

// ============== POWER / ENERGY CONSTANTS ======
// ASSUMED_VOLTAGE will be replaced with measured voltageRMS

// ============== RUNTIME VARIABLES =============
float currentRMS       = 0.0;
float voltageRMS       = 0.0;             // Measured input voltage from divider (Volts)
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
void readVoltageSensor();
void calculatePowerParameters();
void checkAlerts();
void aggregateData();
void updateDisplay();
void checkModeButton();
void sendDataToSerial();
void sendDataToWiFi();
void connectToWiFi();
void checkWiFiConnection();
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

  // Calibrate current sensor with NO LOAD connected
  calibrateCurrentSensor();
  // Voltage sensor doesn't need calibration - passive divider, just reads ADC

  // Connect to WiFi
  connectToWiFi();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Smart Energy Meter");
  lcd.setCursor(0, 1);
  if (wifiConnected) {
    lcd.print("WiFi Connected");
  } else {
    lcd.print("WiFi Failed");
  }
  delay(1500);
  lcd.clear();
}

// ================= LOOP =================
void loop() {
  unsigned long currentTime = millis();

  // 1) Always read sensors (currentRMS and voltageRMS)
  readSensors();
  readVoltageSensor();

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

  // 6) Check WiFi connection periodically
  if (currentTime - lastWiFiAttempt >= WIFI_RECONNECT_INTERVAL) {
    checkWiFiConnection();
    lastWiFiAttempt = currentTime;
  }

  // 7) Every ~1 s: send JSON-style data on Serial AND WiFi (faster updates)
  if ((currentTime / 1000) != ((currentTime - 50) / 1000)) {
    sendDataToSerial();  // Always send to Serial for debugging
    if (wifiConnected) {
      sendDataToWiFi();  // Send to backend server if WiFi is connected
    }
  }
}

// ============ SENSOR & POWER LOGIC ============

// Calibrate ACS712 zero-current offset
// void calibrateCurrentSensor() {
//   const int N_CAL = 2000;
//   long sum = 0;

//   Serial.println("Calibrating current sensor... keep load disconnected.");
//   delay(500);

//   for (int i = 0; i < N_CAL; i++) {
//     int raw = analogRead(CURRENT_SENSOR_PIN);
//     sum += raw;
//     delay(2);
//   }

//   currentOffset = sum / N_CAL;

//   Serial.print("Calibration done. Current offset = ");
//   Serial.println(currentOffset);
//   Serial.println("Now you can connect a load through the ACS712.");
// }

void calibrateCurrentSensor() {
  const int N_CAL = 1000;   // was 2000
  long sum = 0;

  Serial.println("Calibrating current sensor... keep load disconnected.");
  delay(500);

  for (int i = 0; i < N_CAL; i++) {
    int raw = analogRead(CURRENT_SENSOR_PIN);
    sum += raw;
    delay(1);
  }

  currentOffset = sum / N_CAL;

  Serial.print("Calibration done. Current offset = ");
  Serial.println(currentOffset);
  Serial.println("Now you can connect a load through the ACS712.");
}


// Read ACS712 and compute RMS current (Amps)
// void readSensors() {
//   const int N_SAMPLES = 400;
//   double sumI2 = 0;

//   for (int i = 0; i < N_SAMPLES; i++) {
//     int raw = analogRead(CURRENT_SENSOR_PIN);

//     float sensorVolts = (raw - currentOffset) * (ADC_VREF / ADC_MAX);
//     float currentA    = sensorVolts / ACS_SENSITIVITY;

//     // Deadband: ignore small noise on 30A sensor
//     if (fabs(currentA) < 0.30) {
//       currentA = 0.0;
//     }

//     sumI2 += (double)currentA * (double)currentA;
//     delay(2);
//   }

//   currentRMS = sqrt(sumI2 / N_SAMPLES);
// }

void readSensors() {
  const int N_SAMPLES = 500;       // more samples for better RMS
  double sumI2 = 0;
  
  for (int i = 0; i < N_SAMPLES; i++) {
    int raw = analogRead(CURRENT_SENSOR_PIN);

    // Convert ADC to voltage difference from offset
    float sensorVolts = (raw - currentOffset) * (ADC_VREF / ADC_MAX);
    float currentA    = sensorVolts / ACS_SENSITIVITY;

    // MUCH smaller deadband – we only kill tiny noise
    if (fabs(currentA) < 0.01) {   // 0.01 A = 10 mA
      currentA = 0.0;
    }

    sumI2 += (double)currentA * (double)currentA;
    delayMicroseconds(500);        // faster than 2ms, still gives spread
  }

  // RMS of the sampled current
  float newRMS = sqrt(sumI2 / N_SAMPLES);

  // Simple smoothing: low-pass filter to avoid jumping
  // 0.3 = a bit of smoothing, you can make it 0.5 if still too jumpy
  currentRMS = 0.3f * newRMS + 0.7f * currentRMS;
}

// Read voltage sensor from GPIO 35 (passive voltage divider module)
// Module: GND → ESP32 GND, S (signal) → GPIO 35, NC → not connected (no VCC needed)
// Reads ADC multiple times, averages, converts to input voltage using divider ratio
void readVoltageSensor() {
  const int N_SAMPLES = 20;  // Number of ADC samples to average for stability
  long adcSum = 0;
  
  // Take multiple ADC readings and average
  for (int i = 0; i < N_SAMPLES; i++) {
    adcSum += analogRead(VOLTAGE_SENSOR_PIN);
    delayMicroseconds(100);  // Small delay between samples
  }
  
  // Average ADC reading
  int adcAvg = adcSum / N_SAMPLES;
  
  // Convert ADC to voltage at pin (Vout)
  // Vout = (adc / 4095.0) * 3.3
  float vout = (adcAvg / 4095.0) * 3.3;
  
  // Convert to input voltage using divider ratio
  // Vin = Vout * VOLTAGE_DIVIDER_RATIO
  float vin = vout * VOLTAGE_DIVIDER_RATIO;
  
  // Apply calibration offset
  vin += VOLTAGE_CAL_OFFSET;
  
  // Store the calculated input voltage
  voltageRMS = vin;
}

// Compute real power and accumulate energy
void calculatePowerParameters() {
  realPower = voltageRMS * currentRMS;               // Watts (using measured voltage!)
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
  // Send same format as WiFi for consistency
  // Convert to smaller units to match website display
  Serial.print("{\"current_mA\":");
  Serial.print(currentRMS * 1000, 1);  // Convert to milliamps to match WiFi
  Serial.print(",\"current_A\":");
  Serial.print(currentRMS, 3);  // Also show in Amps for reference
  Serial.print(",\"power_W\":");
  Serial.print(realPower, 1);
  Serial.print(",\"energy_mWh\":");
  Serial.print(energyConsumed * 1000, 1);  // Convert to mWh to match WiFi
  Serial.print(",\"energy_Wh\":");
  Serial.print(energyConsumed, 3);  // Also show in Wh for reference
  Serial.print(",\"voltage\":");
  char voltageBuf[10];
  snprintf(voltageBuf, sizeof(voltageBuf), "%.2f", voltageRMS);
  Serial.print(voltageBuf);  // Voltage with 2 decimal places (matches frontend)
  Serial.print(",\"rawAdc\":");
  Serial.print(analogRead(VOLTAGE_SENSOR_PIN));  // Current ADC reading for debugging
  Serial.print(",\"alert\":");
  Serial.print(alertActive ? "true" : "false");
  Serial.println("}");
  
  // Also print human-readable format matching Serial Monitor expectation
  Serial.printf("Voltage(V): %.2f\n", voltageRMS);
}

// ============== WIFI FUNCTIONS =============

void connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); // Disconnect any existing connection
  delay(100);
  
  #if WIFI_PRIORITY_PRIMARY_FIRST
    // Try primary WiFi first
    Serial.print("Trying primary WiFi: ");
    Serial.println(PRIMARY_SSID);
    Serial.println("Using basic WPA2 authentication...");
    WiFi.begin(PRIMARY_SSID, PRIMARY_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    // If primary WiFi failed, try school WiFi
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("\n✗ Primary WiFi failed, trying school WiFi...");
      WiFi.disconnect();
      delay(100);
      
      Serial.print("Connecting to school WiFi: ");
      Serial.println(SCHOOL_SSID);
      Serial.println("Using WPA2-Enterprise authentication...");
      
      // WPA2-Enterprise connection (for school/corporate WiFi)
      esp_wifi_sta_wpa2_ent_set_identity((uint8_t *)SCHOOL_USERNAME, strlen(SCHOOL_USERNAME));
      esp_wifi_sta_wpa2_ent_set_username((uint8_t *)SCHOOL_USERNAME, strlen(SCHOOL_USERNAME));
      esp_wifi_sta_wpa2_ent_set_password((uint8_t *)SCHOOL_PASSWORD, strlen(SCHOOL_PASSWORD));
      esp_wifi_sta_wpa2_ent_enable();
      
      WiFi.begin(SCHOOL_SSID);
      
      attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(1000);  // Longer delay for enterprise networks
        Serial.print(".");
        attempts++;
      }
    }
  #else
    // Direct school WiFi connection (skip home)
    Serial.print("Connecting to school WiFi: ");
    Serial.println(SCHOOL_SSID);
    Serial.println("Using WPA2-Enterprise authentication...");
    
    esp_wifi_sta_wpa2_ent_set_identity((uint8_t *)SCHOOL_USERNAME, strlen(SCHOOL_USERNAME));
    esp_wifi_sta_wpa2_ent_set_username((uint8_t *)SCHOOL_USERNAME, strlen(SCHOOL_USERNAME));
    esp_wifi_sta_wpa2_ent_set_password((uint8_t *)SCHOOL_PASSWORD, strlen(SCHOOL_PASSWORD));
    esp_wifi_sta_wpa2_ent_enable();
    
    WiFi.begin(SCHOOL_SSID);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
      delay(1000);  // Longer delay for enterprise networks
      Serial.print(".");
      attempts++;
    }
  #endif
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    wifiConnected = false;
    Serial.println("\n✗ WiFi connection failed!");
    Serial.println("Possible reasons:");
    Serial.println("  - Wrong username or password");
    Serial.println("  - Network requires certificate");
    Serial.println("  - Network isolates devices");
    Serial.println("  - MAC address not registered");
    Serial.println("  - WiFi router is too far away");
    Serial.println("\nData will still be sent over Serial.");
  }
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("WiFi disconnected. Attempting to reconnect...");
      wifiConnected = false;
    }
    connectToWiFi();
  } else {
    if (!wifiConnected) {
      wifiConnected = true;
      Serial.println("WiFi reconnected!");
    }
  }
}

void sendDataToWiFi() {
  if (!wifiConnected || WiFi.status() != WL_CONNECTED) {
    return;
  }

  // Check if using HTTPS (Render deployment)
  bool useHTTPS = (strstr(SERVER_URL, "https://") != NULL);
  
  HTTPClient http;
  if (useHTTPS) {
    WiFiClientSecure client;
    client.setInsecure(); // Accept any certificate (acceptable for class demo)
    http.begin(client, SERVER_URL);
  } else {
    http.begin(SERVER_URL);
  }
  http.addHeader("Content-Type", "application/json");

  // Create JSON payload matching backend REST API format
  // Use EXACT SAME voltageRMS variable that is printed to Serial (no recomputation)
  char voltageStr[10];
  snprintf(voltageStr, sizeof(voltageStr), "%.2f", voltageRMS);  // 2 decimal places, matches Serial
  
  String jsonPayload = "{";
  jsonPayload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  jsonPayload += "\"voltage\":" + String(voltageStr) + ",";  // Same value as Serial, 2 decimals
  jsonPayload += "\"current\":" + String(currentRMS * 1000, 1) + ",";  // Convert to mA
  jsonPayload += "\"power\":" + String(realPower, 1) + ",";
  jsonPayload += "\"rawAdc\":" + String(analogRead(VOLTAGE_SENSOR_PIN)) + ",";
  jsonPayload += "\"timestamp\":" + String(millis());
  jsonPayload += "}";

  int httpResponseCode = http.POST(jsonPayload);
  
  if (httpResponseCode > 0) {
    Serial.print("WiFi POST success: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("WiFi POST failed: ");
    Serial.println(httpResponseCode);
    String response = http.getString();
    Serial.print("Response: ");
    Serial.println(response);
  }
  
  http.end();
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

float findMaxPower() 
  float maxP = 0;
  for (int i = 0; i < 60; i++) {
    if (powerReadings[i] > maxP) {
      maxP = powerReadings[i];
    }
  }
  return maxP;
}
