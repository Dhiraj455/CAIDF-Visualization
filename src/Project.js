import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import PatientLogistic from "./components/PatientLogistic";
import PatientTimeLine from "./components/PatientTimeLine";
import PatientInfo from "./components/PatientInfo";
import ReadinessRadarChart from "./components/ReadinessRadarChart";
import RiskTrendGraph from "./components/RiskTrendGraph";
import "./Project.css";

export default function Project() {
  const { patientNumber: patientNumberParam } = useParams();
  const patientNumber = parseInt(patientNumberParam, 10);
  const navigate = useNavigate();

  const handleBackToWelcome = () => {
    navigate("/");
  };

  return (
    <div className="project-container">
      <div className="background-glow"></div>

      <nav className="nav-bar">
        <h2 className="nav-title">
          🧠 CAIDF Visualization System - Patient {patientNumber}
        </h2>
        <div className="nav-actions">
          <span className="nav-action-item" onClick={handleBackToWelcome} style={{ cursor: 'pointer' }}>
            ← Back to Welcome
          </span>
          <span className="nav-action-item">👥 Compare Patients</span>
          <span className="nav-action-item">🔍 Filter by Risk Domain</span>
          <span className="nav-action-item">🖨️ Export Summary</span>
        </div>
      </nav>

      {/* 🩺 Main Content */}
      {/* Top Row: Patient Info (left) and Patient Timeline (right) */}
      <div className="top-section">
        <div className="top-panel-item top-panel-info">
          <PatientInfo patientNumber={patientNumber} />
        </div>
        <div className="top-panel-item top-panel-timeline">
          <PatientTimeLine patientNumber={patientNumber} />
        </div>
      </div>

      {/* Bottom Row: Radar Chart (30%), Risk Trend (40%), Patient Logistic (30%) */}
      <div className="bottom-section">
        <div className="bottom-panel-item bottom-panel-radar">
          <ReadinessRadarChart patientNumber={patientNumber} />
        </div>
        <div className="bottom-panel-item bottom-panel-risk">
          <RiskTrendGraph patientNumber={patientNumber} />
        </div>
        <div className="bottom-panel-item bottom-panel-logistic">
          <PatientLogistic patientNumber={patientNumber} />
        </div>
      </div>
    </div>
  );
}