export interface CatalogModule {
  id: string;
  group: string;
  displayName: string;
  model: string;
  description: string;
  sensors: string[];
  pinHints: string;
  notes: string;
}

export const MODULE_CATALOG: CatalogModule[] = [
  // === Eyes & Senses ===
  {
    id: "ultrasonic-hcsr04",
    group: "Eyes & Senses",
    displayName: "Ultrasonic Distance Sensor",
    model: "HC-SR04",
    description:
      "Uses sound waves to detect walls and obstacles. The custom EcoBot PCB includes a voltage divider to keep the echo signal safe for the Pico W's 3.3V GPIO.",
    sensors: ["distance_cm"],
    pinHints: "Trigger: any GPIO out, Echo: GPIO with voltage divider",
    notes: "Detects 2cm–400cm. Voltage divider on custom PCB protects the Pico.",
  },
  {
    id: "ir-obstacle-fc51",
    group: "Eyes & Senses",
    displayName: "IR Obstacle Sensor",
    model: "FC-51",
    description:
      "Provides fast, close-range detection using infrared light. Perfect for emergency stops before a collision or line-following robots.",
    sensors: ["obstacle_detected"],
    pinHints: "OUT pin → any GPIO in (digital)",
    notes: "Fast response time. Great for line-following or bump detection.",
  },
  {
    id: "microphone-ky037",
    group: "Eyes & Senses",
    displayName: "Sound / Microphone Sensor",
    model: "KY-037",
    description:
      "Detects loud noises or claps. The EcoBot design uses a 0.1µF capacitor to filter out motor noise from the audio signal.",
    sensors: ["sound_level", "clap_detected"],
    pinHints: "AO → ADC pin (GP26–GP28), DO → any GPIO in",
    notes: "0.1µF cap filters motor noise. Use analog pin for volume level.",
  },
  {
    id: "water-level-analog",
    group: "Eyes & Senses",
    displayName: "Water Level Sensor",
    model: "Standard Analog",
    description:
      "Measures submersion depth using resistance. EcoBot uses a GPIO power trick — only powering the sensor when reading — to prevent the exposed traces from rusting.",
    sensors: ["water_depth_mm"],
    pinHints: "VCC → GPIO out (power trick), SIG → ADC pin",
    notes: "Power via GPIO pin and pull low after reading to prevent corrosion.",
  },
  {
    id: "magnetometer-hmc5883l",
    group: "Eyes & Senses",
    displayName: "Magnetometer",
    model: "HMC5883L",
    description:
      "3-axis digital compass. Detects magnetic field strength and direction. Use it for navigation, orientation, or finding true north.",
    sensors: ["heading_deg", "mag_x", "mag_y", "mag_z"],
    pinHints: "SDA → GP0/GP2, SCL → GP1/GP3 (I2C)",
    notes: "I2C address 0x1E. Calibrate away from motors and metal chassis.",
  },
  {
    id: "imu-mpu9250",
    group: "Eyes & Senses",
    displayName: "Gyroscope & Accelerometer",
    model: "MPU-9250",
    description:
      "9-axis IMU: 3-axis gyroscope, 3-axis accelerometer, and 3-axis magnetometer. Ideal for balance bots, tilt detection, and motion tracking.",
    sensors: ["accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z"],
    pinHints: "SDA → GP0/GP2, SCL → GP1/GP3 (I2C). Address 0x68 or 0x69",
    notes: "I2C or SPI. Use MicroPython micropython-mpu9250 library.",
  },
  {
    id: "camera-ov7670",
    group: "Eyes & Senses",
    displayName: "Camera Module",
    model: "OV7670",
    description:
      "30fps VGA camera module (640×480). Capture images for object detection, line following, or remote monitoring via the Pico W's Wi-Fi.",
    sensors: ["image_frame"],
    pinHints: "Parallel 8-bit data bus + PCLK/HREF/VSYNC. Many GPIO pins needed.",
    notes: "Requires significant GPIO pins and DMA. Best for image capture, not live video.",
  },

  // === Motion & Muscle ===
  {
    id: "tt-gear-motors",
    group: "Motion & Muscle",
    displayName: "Dual TT Gear Motors",
    model: "Yellow TT Motors",
    description:
      "The EcoBot drive system. The PCB features 1N4001 flyback diodes and noise-suppression capacitors for a 'clean' electrical build that protects the Pico.",
    sensors: [],
    pinHints: "Motor driver IN1/IN2/IN3/IN4 → GPIO, ENA/ENB → PWM-capable GPIO",
    notes: "Flyback diodes + caps on PCB. Pair with Motor Controller module.",
  },
  {
    id: "wheels-tt",
    group: "Motion & Muscle",
    displayName: "Wheels (for TT Motors)",
    model: "65mm TT Wheel",
    description:
      "65mm rubber wheels designed for TT gear motors. Snap directly onto the motor shaft. Available in various colors.",
    sensors: [],
    pinHints: "No wiring — mechanical attachment to TT motor shaft",
    notes: "Must be paired with Dual TT Gear Motors. Check axle diameter matches.",
  },
  {
    id: "servo-sg90",
    group: "Motion & Muscle",
    displayName: "Micro Servo Motor",
    model: "SG90",
    description:
      "Provides precise 180° rotation. The EcoBot module includes a 100µF buffer capacitor to prevent the Pico from browning out when the servo draws peak current.",
    sensors: ["angle_deg"],
    pinHints: "Signal → any PWM-capable GPIO (e.g. GP0). 50Hz, 1–2ms pulse width.",
    notes: "100µF cap on PCB prevents Pico brownout. Use machine.PWM in MicroPython.",
  },

  // === Interaction & Output ===
  {
    id: "joystick-ky023",
    group: "Interaction & Output",
    displayName: "Dual-Axis Joystick",
    model: "KY-023",
    description:
      "XY analog joystick with a push button for manual remote control. Features a 10kΩ hardware pull-up resistor on the button for reliable click detection.",
    sensors: ["x_axis", "y_axis", "button"],
    pinHints: "VRX → GP26, VRY → GP27 (ADC), SW → GPIO in with pull-up",
    notes: "ADC reads 0–65535 for X/Y. 10kΩ pull-up on button. Read 0 = pressed.",
  },
  {
    id: "led-matrix-max7219",
    group: "Interaction & Output",
    displayName: "8×8 LED Dot Matrix",
    model: "MAX7219",
    description:
      "Display icons, letters, scrolling text, or status patterns on a bright 8×8 LED grid. Fits the EcoBot's 5-pin magnetic connector standard.",
    sensors: [],
    pinHints: "DIN → MOSI (GP7), CLK → SCK (GP6), CS → any GPIO (SPI)",
    notes: "SPI interface. Use max7219 MicroPython library. Chain multiple for wider display.",
  },
];

export function getCatalogModule(id: string): CatalogModule | undefined {
  return MODULE_CATALOG.find((m) => m.id === id);
}
