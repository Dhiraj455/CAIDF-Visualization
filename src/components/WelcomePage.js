import React from "react";
import { useNavigate } from "react-router-dom";
import "./WelcomePage.css";

export default function WelcomePage() {
  const navigate = useNavigate();

  const handleSelectPatient = (patientNumber) => {
    navigate(`/patient/${patientNumber}`);
  };

  return (
    <section className="testing-page">
      <div className="testing-page-background-glow"></div>
      <div className="testing-page-content">
        <h1>Welcome to the Usability Testing Session</h1>

      <p>
        Thank you for participating in our usability study. 
        Today's session will take about <strong>10 minutes</strong>. 
        Your feedback helps us improve the design.
      </p>

      <h2>Before We Begin</h2>
      <ul>
        <li><strong>You are not being tested.</strong> We are testing the software.</li>
        <li>There are <strong>no right or wrong answers.</strong></li>
        <li>If something feels confusing, that actually helps us improve the system.</li>
      </ul>

      <h2>While Using the System</h2>
      <ul>
        <li>
          <strong>Think aloud:</strong> 
          please say what you're trying to do, what you expect, and what confuses you.
        </li>
        <li>
          You may ask questions, but during the task I may say 
          <em> "What do you think would happen?"</em> instead of answering.  
          This keeps the test unbiased.
        </li>
        <li>
          You may explore freely before performing the assigned tasks.
        </li>
      </ul>

      <h2>What the Moderator Will Do</h2>
      <ul>
        <li>Take notes on where you hesitate or encounter confusion</li>
        <li>Measure how long each task takes</li>
        <li>Observe your expectations and mental model</li>
      </ul>

      <h2>After the Tasks</h2>
      <ul>
        <li>A short interview about your experience</li>
        <li>Questions like:
          <ul>
            <li>"What worked well?"</li>
            <li>"Where did you get stuck?"</li>
            <li>"What would you change?"</li>
          </ul>
        </li>
      </ul>

      <p className="testing-note">
        This page summarizes everything you need to know about today's session.
      </p>

      <div className="patient-selection">
        <h2>Select a Patient to View</h2>
        <div className="patient-buttons">
          <button 
            className="patient-button patient-button-1"
            onClick={() => handleSelectPatient(1)}
          >
            <div className="patient-button-content">
              <span className="patient-button-icon">👤 Patient 1</span>
            </div>
          </button>
          <button 
            className="patient-button patient-button-2"
            onClick={() => handleSelectPatient(2)}
          >
            <div className="patient-button-content">
              <span className="patient-button-icon">👤 Patient 2</span>
            </div>
          </button>
        </div>
      </div>
      </div>
    </section>
  );
}

