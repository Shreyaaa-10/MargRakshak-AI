window.MargData = {
  driver: {
    name: "Aarav Sharma",
    vehicle: "MH-12-AB-4591",
    shift: "Morning — 06:00 to 14:00",
  },
  live: {
    status: "ALERT",
    statusLabel: "Driver alert",
    ear: 0.29,
    mar: 0.18,
    headPitch: 4,
    blinksPerMin: 16,
    sessionMinutes: 42,
  },
  alerts: [
    { id: "A-1042", time: "10:14", type: "Drowsiness", detail: "Eye closure above threshold", severity: "High", status: "Acknowledged" },
    { id: "A-1041", time: "09:51", type: "Yawn", detail: "Mouth aspect ratio spike", severity: "Medium", status: "Logged" },
    { id: "A-1040", time: "09:22", type: "Head pose", detail: "Looking down for 3.2s", severity: "Medium", status: "Logged" },
    { id: "A-1039", time: "08:47", type: "Distraction", detail: "Gaze off-road (dummy)", severity: "High", status: "Acknowledged" },
    { id: "A-1038", time: "08:12", type: "Drowsiness", detail: "Slow blink pattern", severity: "Low", status: "Logged" },
    { id: "A-1037", time: "07:58", type: "Yawn", detail: "Two yawns in 60s", severity: "Medium", status: "Logged" },
  ],
  hourlyDrowsyScore: [12, 18, 15, 22, 35, 28, 19, 14],
  hourLabels: ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"],
  alertTypes: { Drowsiness: 9, Yawn: 6, "Head pose": 4, Distraction: 3 },
  weeklyIncidents: [4, 7, 5, 9, 6, 3, 2],
  weekLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
