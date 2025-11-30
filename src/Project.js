import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PatientLogistic from "./components/PatientLogistic";
import PatientTimeLine from "./components/PatientTimeLine";
import PatientInfo from "./components/PatientInfo";
import ReadinessRadarChart from "./components/ReadinessRadarChart";
import RiskTrendGraph from "./components/RiskTrendGraph";
import { exportPatientSummaryToPDF } from "./utils/exportToPDF";
import "./Project.css";

export default function Project() {
  const { patientNumber: patientNumberParam } = useParams();
  const patientNumber = parseInt(patientNumberParam, 10);
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const handleBackToWelcome = () => {
    navigate("/");
  };

  const handleExportSummary = async () => {
    setIsExporting(true);
    setExportProgress("Preparing export...");
    
    try {
      await exportPatientSummaryToPDF(patientNumber, (progress) => {
        setExportProgress(progress);
      });
      setExportProgress("Export completed successfully!");
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress("");
      }, 2000);
    } catch (error) {
      console.error("Export failed:", error);
      setExportProgress("Export failed. Please try again.");
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress("");
      }, 3000);
    }
  };

  return (
    <div className="patient-page">
      <div className="background-glow"></div>

      <nav className="nav-bar">
        <h2 className="nav-title">
          🧠 CAIDF Visualization System - Patient {patientNumber}
        </h2>
        <div className="nav-actions">
          <span className="nav-action-item" onClick={handleBackToWelcome} style={{ cursor: 'pointer' }}>
            ← Back to Welcome
          </span>
          <span 
            className="nav-action-item" 
            onClick={handleExportSummary}
            style={{ cursor: isExporting ? 'wait' : 'pointer', opacity: isExporting ? 0.6 : 1 }}
          >
            {isExporting ? '⏳ Exporting...' : '🖨️ Export Summary'}
          </span>
          {exportProgress && (
            <span className="nav-action-item" style={{ fontSize: '0.75rem', color: '#6B7280' }}>
              {exportProgress}
            </span>
          )}
        </div>
      </nav>

      {/* Main Content - 2-row grid */}
      <div className="patient-page-content">
        {/* Top Row: Patient Info (left) | Timeline (right) */}
        <div className="top-panel-info">
          <PatientInfo patientNumber={patientNumber} />
        </div>
        <div className="top-panel-timeline">
          <PatientTimeLine patientNumber={patientNumber} />
        </div>

        {/* Bottom Row: Logistics | Risk Trend | Radar */}
        <div className="bottom-row">
          <div className="bottom-panel-logistic">
            <PatientLogistic patientNumber={patientNumber} />
          </div>
          <div className="bottom-panel-risk">
            <RiskTrendGraph patientNumber={patientNumber} />
          </div>
          <div className="bottom-panel-radar">
            <ReadinessRadarChart patientNumber={patientNumber} />
          </div>
        </div>
      </div>
    </div>
  );
}
