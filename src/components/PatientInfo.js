import React from "react";
import { usePatientData } from "../utils/usePatientData";
import "./PatientInfo.css";

export default function PatientInfo({ patientNumber = 1 }) {
  const { sections, loading } = usePatientData(patientNumber);

  // Extract patient info from sections
  const patientInfoSection = sections.find(s => s.phase === "patient_info");
  
  // Parse patient info from content
  const parsePatientInfo = () => {
    if (!patientInfoSection || !patientInfoSection.content) {
      return {
        name: "N/A",
        ageGender: "N/A",
        admissionDate: "N/A",
        dischargeDate: "N/A",
        disposition: "N/A"
      };
    }

    const content = patientInfoSection.content;
    const lines = content.split('\n').map(line => line.replace(/^•\s*/, '').trim());
    
    const info = {
      name: "N/A",
      ageGender: "N/A",
      admissionDate: "N/A",
      dischargeDate: "N/A",
      disposition: "N/A"
    };

    lines.forEach(line => {
      if (line.startsWith("Patient Name:")) {
        info.name = line.replace(/^Patient Name:\s*/i, '').trim();
      } else if (line.startsWith("Age/Gender:") || line.startsWith("Age\\/Gender:")) {
        info.ageGender = line.replace(/^Age\/?Gender:\s*/i, '').trim();
      } else if (line.startsWith("Admission Date:")) {
        info.admissionDate = line.replace(/^Admission Date:\s*/i, '').trim();
      } else if (line.startsWith("Discharge Date:")) {
        info.dischargeDate = line.replace(/^Discharge Date:\s*/i, '').trim();
      } else if (line.startsWith("Discharge Disposition:")) {
        info.disposition = line.replace(/^Discharge Disposition:\s*/i, '').trim();
      }
    });

    return info;
  };

  const patientInfo = parsePatientInfo();

  if (loading) {
    return (
      <div className="patient-info-loading">
        Loading patient information...
      </div>
    );
  }

  return (
    <div className="patient-info-container">
      <h3 className="patient-info-title">
        <span>👤</span>
        <span>Patient Information</span>
      </h3>

      <div className="patient-info-content">
        <div className="patient-info-field">
          <div className="patient-info-label">
            Patient Name
          </div>
          <div className="patient-info-value">
            {patientInfo.name}
          </div>
        </div>

        <div className="patient-info-field">
          <div className="patient-info-label">
            Age / Gender
          </div>
          <div className="patient-info-value">
            {patientInfo.ageGender}
          </div>
        </div>

        <div className="patient-info-field">
          <div className="patient-info-label">
            Admission Date
          </div>
          <div className="patient-info-value">
            {patientInfo.admissionDate}
          </div>
        </div>

        <div className="patient-info-field">
          <div className="patient-info-label">
            Discharge Date
          </div>
          <div className="patient-info-value">
            {patientInfo.dischargeDate}
          </div>
        </div>

        <div className="patient-info-field">
          <div className="patient-info-label">
            Discharge Disposition
          </div>
          <div className="patient-info-value-disposition">
            {patientInfo.disposition}
          </div>
        </div>
      </div>
    </div>
  );
}

