// src/utils/dataExtractor.js

export function extractPatientData(dischargeText) {
  const data = {};

  // --- Patient info ---
  const patientMatch = dischargeText.match(/Patient Name:\s*(.*)/i);
  const genderMatch = dischargeText.match(/Age\/Gender:\s*(.*)/i);
  data.patient = {
    name: patientMatch ? patientMatch[1].trim() : "Unknown",
    ageGender: genderMatch ? genderMatch[1].trim() : "Unknown",
  };

  // --- Education ---
  const eduMatch = dischargeText.match(/Education:(.*?)(Follow-Up|$)/is);
  let educationList = [];
  if (eduMatch) {
    educationList = eduMatch[1]
      .split(/[,.\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  }
  data.education = {
    topics: educationList,
    completed: Math.floor(educationList.length * 0.7), // assume 70% done
  };

  // --- Follow-ups ---
  const followUpMatch = dischargeText.match(
    /Follow-Up Arrangements(.*?)Medications:/is
  );
  let followUps = [];
  if (followUpMatch) {
    followUps = followUpMatch[1]
      .split(/[,.\n]/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0)
      .map((f) => ({
        name: f,
        completed:
          f.toLowerCase().includes("arranged") ||
          f.toLowerCase().includes("clinic"),
      }));
  }
  data.followUps = followUps;

  // --- Medications ---
  const medsMatch = dischargeText.match(/Medications:(.*)/is);
  let meds = [];
  if (medsMatch) {
    meds = medsMatch[1]
      .split(/[,.\n]/)
      .map((m) => m.trim())
      .filter((m) => m.length > 0)
      .map((m) => ({
        name: m,
        status: m.toLowerCase().includes("reduced")
          ? "adjusted"
          : m.toLowerCase().includes("during stay")
          ? "completed"
          : "active",
      }));
  }
  data.medications = meds;

  // --- Caregiver ---
  const caregiverMatch = dischargeText.match(
    /Self-care\/Caregiving:(.*?)(Hospital|$)/is
  );
  if (caregiverMatch) {
    const caregiverText = caregiverMatch[1];
    data.caregiver = {
      text: caregiverText.trim(),
      status: caregiverText.includes("24/7")
        ? "full"
        : caregiverText.includes("checks in frequently")
        ? "partial"
        : "unknown",
    };
  } else {
    data.caregiver = { text: "No details", status: "unknown" };
  }

  return data;
}
