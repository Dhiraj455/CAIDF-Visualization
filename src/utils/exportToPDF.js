import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { extractPatientData } from './extract';
import { extractRiskTrendData } from './extractRiskTrend';
import { extractReadinessGrid } from './extractReadinessGrid';
import patient1Data from '../data/Patient1.txt';
import patient2Data from '../data/Patient2.txt';

/**
 * Parses sections from discharge text (similar to usePatientData but without React hooks)
 */
function parseSectionsFromText(dischargeText) {
  const phases = [
    {
      key: "patient_info",
      label: "Patient_info",
      order: -1,
      rules: [
        /^Patient Name/i,
        /^Age\/?Gender/i,
        /^Admission Date/i,
        /^Discharge Date/i,
        /^Discharge Disposition/i,
      ],
    },
    {
      key: "home",
      label: "Home",
      order: 0,
      rules: [
        /^Comorbidities/i,
        /^Prior level of function/i,
        /^Self-?care\/?Caregiving/i,
        /^Primary Providers/i,
        /^Consult to Social work/i,
      ],
    },
    {
      key: "er",
      label: "ER",
      order: 1,
      rules: [
        /^Overview/i,
        /^Most Responsible Diagnosis/i,
        /^Hospital Course/i,
        /^Patient with multiple medical problems/i,
      ],
    },
    {
      key: "unit",
      label: "Unit",
      order: 2,
      rules: [
        /^Hospital Management/i,
        /^Medical management/i,
        /^Pain management/i,
        /^Substance Abuse/i,
        /^Wound care/i,
        /^Chronic risk for constipation/i,
        /^Chronic Urinary incontinence/i,
        /^Activities of Daily Living\/?Functional mobility/i,
        /^Durable Medical Equipment/i,
        /^Feeding\/Swallowing/i,
        /^Risk for /i,
        /^Decreased /i,
        /^Impaired /i,
        /Discipline:\s*(MD|RN|PT|OT|SLP|SW)/i,
      ],
    },
    {
      key: "discharge",
      label: "Discharge",
      order: 3,
      rules: [
        /^Discharge Plan/i,
        /^Substance Use/i,
        /^Skin\/Wound Care/i,
        /^Mobility/i,
        /^Swallowing/i,
        /^Communication/i,
        /^Medication assistance/i,
        /^Education/i,
      ],
    },
    {
      key: "back_home",
      label: "Back_Home",
      order: 4,
      rules: [/^Follow-?Up Arrangements/i, /^Medications/i],
    },
  ];

  const classify = (line) => {
    const hit = phases.find((p) => p.rules.some((re) => re.test(line)));
    if (hit) return hit.key;
    return /Hospital Management/i.test(line) ? "unit" : "home";
  };

  if (!dischargeText) return [];

  const lines = String(dischargeText)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Expand "Hospital Management" into individual "Label: content" lines
  const expanded = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/^Hospital Management:?/i.test(L)) {
      expanded.push(L);
      for (let j = i + 1; j < lines.length; j++) {
        const nxt = lines[j];
        if (/^(Discharge Plan|Follow-?Up|Medications)/i.test(nxt)) break;
        if (!/:/.test(nxt)) break;
        expanded.push(nxt);
        i = j;
      }
    } else {
      expanded.push(L);
    }
  }

  const headersNoColon = [/^Most Responsible Diagnosis$/i];
  const attachToPrev = [/^Consult to Social work/i];

  let inDischargePlan = false;
  const rows = [];

  for (let i = 0; i < expanded.length; i++) {
    const line = expanded[i];

    if (/^Discharge Plan:?/i.test(line)) {
      inDischargePlan = true;
    }
    if (/^(Follow-?Up Arrangements|Medications):?/i.test(line)) {
      inDischargePlan = false;
    }

    if (headersNoColon.some((re) => re.test(line))) {
      const next = (expanded[i + 1] || "").replace(/^[–—-]\s*/, "").trim();
      const phase = inDischargePlan && /^(Risk for|Decreased|Impaired|Mobility|Swallowing|Communication|Skin\/Wound Care|Education)/i.test(line)
        ? "discharge"
        : classify(line);
      rows.push({
        id: `sec_${rows.length + 1}`,
        phase: phase,
        label: line.trim(),
        content: next,
      });
      i++;
      continue;
    }
    if (attachToPrev.some((re) => re.test(line)) && rows.length) {
      rows[rows.length - 1].content += " " + line.trim();
      continue;
    }

    const m = line.match(/^([^:]+):\s*(.*)$/);
    const phase = inDischargePlan && /^(Risk for|Decreased|Impaired|Mobility|Swallowing|Communication|Skin\/Wound Care|Education|Substance Use|Medication assistance)/i.test(m ? m[1] : line)
      ? "discharge"
      : classify(line);
    rows.push({
      id: `sec_${rows.length + 1}`,
      phase: phase,
      label: m ? m[1].trim() : line,
      content: m ? m[2].trim() : line,
    });
  }

  // Merge sections by phase
  const byPhase = new Map();
  rows.forEach((row) => {
    if (!byPhase.has(row.phase)) {
      byPhase.set(row.phase, []);
    }
    byPhase.get(row.phase).push(row);
  });

  const merged = [];
  for (const p of phases) {
    const items = byPhase.get(p.key) || [];
    if (!items.length) continue;

    let count = items.length;
    if (p.key === "patient_info") count = 0;

    merged.push({
      id: `merged_${p.key}`,
      phase: p.key,
      label: p.label,
      content: items.map((d) => `• ${d.label}: ${d.content}`).join("\n"),
      count,
    });
  }

  return merged;
}

/**
 * Parses content into bullet points
 */
function parseContentToBullets(content) {
  if (!content) return [];
  const lines = content.split('\n').filter(line => line.trim());
  return lines
    .map(line => {
      const cleanLine = line.replace(/^•\s*/, '').trim();
      const match = cleanLine.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        return { label: match[1].trim(), text: match[2].trim() };
      }
      return { text: cleanLine };
    })
    .filter(item => item.text && item.text.length > 0);
}

/**
 * Exports patient summary to PDF
 * @param {number} patientNumber - Patient number (1 or 2)
 * @param {Function} onProgress - Optional callback for progress updates
 */
export async function exportPatientSummaryToPDF(patientNumber, onProgress) {
  try {
    if (onProgress) onProgress('Loading patient data...');

    // Load patient data
    const patientFile = patientNumber === 1 ? patient1Data : patient2Data;
    const response = await fetch(patientFile);
    const dischargeText = await response.text();

    // Extract data
    const patientData = extractPatientData(dischargeText);
    const riskTrendData = extractRiskTrendData(dischargeText);
    const readinessGrid = extractReadinessGrid(dischargeText);
    const sections = parseSectionsFromText(dischargeText);

    // Extract patient info
    const patientInfoMatch = dischargeText.match(/Patient Name:\s*(.*)/i);
    const ageGenderMatch = dischargeText.match(/Age\/Gender:\s*(.*)/i);
    const admissionMatch = dischargeText.match(/Admission Date:\s*(\d+\/\d+)/i);
    const dischargeMatch = dischargeText.match(/Discharge Date:\s*(\d+\/\d+)/i);
    const dispositionMatch = dischargeText.match(/Discharge Disposition:\s*(.*)/i);

    const patientName = patientInfoMatch ? patientInfoMatch[1].trim() : 'Unknown';
    const ageGender = ageGenderMatch ? ageGenderMatch[1].trim() : 'Unknown';
    const admissionDate = admissionMatch ? admissionMatch[1] : 'N/A';
    const dischargeDate = dischargeMatch ? dischargeMatch[1] : 'N/A';
    const disposition = dispositionMatch ? dispositionMatch[1].trim() : 'N/A';

    if (onProgress) onProgress('Capturing visualizations...');

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Helper function to add new page if needed
    const checkNewPage = (requiredHeight) => {
      if (yPosition + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Helper function to add text with proper word wrap
    const addText = (text, fontSize, isBold = false, color = [0, 0, 0], xOffset = 0, maxWidth = null) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      pdf.setTextColor(color[0], color[1], color[2]);
      
      const textWidth = maxWidth || (contentWidth - xOffset);
      const lines = pdf.splitTextToSize(text, textWidth);
      const lineHeight = fontSize * 0.4 + 2;
      
      lines.forEach((line) => {
        checkNewPage(lineHeight);
        pdf.text(line, margin + xOffset, yPosition);
        yPosition += lineHeight;
      });
    };

    // Helper function to add section header
    const addSectionHeader = (title) => {
      yPosition += 10;
      checkNewPage(15);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(37, 99, 235);
      const lines = pdf.splitTextToSize(title, contentWidth);
      lines.forEach((line) => {
        checkNewPage(8);
        pdf.text(line, margin, yPosition);
        yPosition += 8;
      });
      yPosition += 3;
    };

    // Helper function to add subsection header
    const addSubsectionHeader = (title) => {
      yPosition += 6;
      checkNewPage(12);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(75, 85, 99);
      const lines = pdf.splitTextToSize(title, contentWidth);
      lines.forEach((line) => {
        checkNewPage(7);
        pdf.text(line, margin, yPosition);
        yPosition += 7;
      });
      yPosition += 2;
    };

    // Helper function to add bullet point with proper formatting
    const addBulletPoint = (text, label = null, indent = 8) => {
      checkNewPage(6);
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      
      const bullet = '  • ';
      const bulletWidth = pdf.getTextWidth(bullet);
      
      if (label) {
        // Format as "Label: text"
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(59, 130, 246);
        pdf.text(bullet, margin + indent, yPosition);
        const labelText = label + ': ';
        pdf.text(labelText, margin + indent + bulletWidth, yPosition);
        
        const labelFullWidth = pdf.getTextWidth(bullet + labelText);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        const textLines = pdf.splitTextToSize(text, contentWidth - indent - labelFullWidth - 5);
        
        textLines.forEach((line, lineIdx) => {
          if (lineIdx === 0) {
            pdf.text(line, margin + indent + labelFullWidth, yPosition);
          } else {
            yPosition += 5;
            checkNewPage(6);
            pdf.text(line, margin + indent + labelFullWidth, yPosition);
          }
        });
      } else {
        // Just text
        pdf.setFont('helvetica', 'normal');
        pdf.text(bullet, margin + indent, yPosition);
        const textLines = pdf.splitTextToSize(text, contentWidth - indent - bulletWidth - 5);
        
        textLines.forEach((line, lineIdx) => {
          if (lineIdx === 0) {
            pdf.text(line, margin + indent + bulletWidth, yPosition);
          } else {
            yPosition += 5;
            checkNewPage(6);
            pdf.text(line, margin + indent + bulletWidth, yPosition);
          }
        });
      }
      
      yPosition += 6;
    };

    // ===== COVER PAGE =====
    pdf.setFillColor(37, 99, 235);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CAIDF Patient Summary Report', pageWidth / 2, 25, { align: 'center' });
    
    pdf.setFontSize(18);
    pdf.text(`Patient ${patientNumber}`, pageWidth / 2, 35, { align: 'center' });
    
    yPosition = 60;
    pdf.setTextColor(0, 0, 0);

    // ===== PATIENT INFORMATION SECTION =====
    addSectionHeader('Patient Information');
    
    // Format patient information nicely with proper alignment
    const infoFields = [
      { label: 'Patient Name', value: patientName },
      { label: 'Age / Gender', value: ageGender },
      { label: 'Admission Date', value: admissionDate },
      { label: 'Discharge Date', value: dischargeDate },
      { label: 'Discharge Disposition', value: disposition },
    ];

    const labelColumnWidth = 60;
    infoFields.forEach((field) => {
      checkNewPage(7);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(75, 85, 99);
      pdf.text(`${field.label}:`, margin, yPosition);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      const valueLines = pdf.splitTextToSize(field.value, contentWidth - labelColumnWidth - 5);
      valueLines.forEach((line, idx) => {
        if (idx === 0) {
          pdf.text(line, margin + labelColumnWidth, yPosition);
        } else {
          yPosition += 5;
          checkNewPage(7);
          pdf.text(line, margin + labelColumnWidth, yPosition);
        }
      });
      yPosition += 7;
    });

    yPosition += 8;

    // ===== CAPTURE TIMELINE VISUALIZATION =====
    if (onProgress) onProgress('Capturing timeline visualization...');
    const timelineElement = document.querySelector('.top-panel-timeline');
    if (timelineElement) {
      checkNewPage(60);
      addSectionHeader('Timeline Visualization');
      const canvas = await html2canvas(timelineElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      checkNewPage(imgHeight + 5);
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    }

    // ===== TIMELINE PHASE DATA =====
    if (onProgress) onProgress('Extracting timeline phase data...');
    
    const phaseLabels = {
      home: "Home",
      er: "ER",
      unit: "Unit",
      discharge: "Discharge",
      back_home: "Back Home"
    };

    const timelinePhases = ["home", "er", "unit", "discharge", "back_home"];
    const phasesWithData = sections
      .filter(s => timelinePhases.includes(s.phase) && s.count > 0)
      .sort((a, b) => {
        const orderA = timelinePhases.indexOf(a.phase);
        const orderB = timelinePhases.indexOf(b.phase);
        return orderA - orderB;
      });

    if (phasesWithData.length > 0) {
      addSectionHeader('Timeline Phase Details');
      
      phasesWithData.forEach((phaseSection) => {
        const phaseLabel = phaseLabels[phaseSection.phase] || phaseSection.phase;
        
        addSubsectionHeader(`${phaseLabel} Phase (${phaseSection.count} items)`);
        
        const bullets = parseContentToBullets(phaseSection.content);
        
        if (bullets.length > 0) {
          bullets.forEach((bullet) => {
            addBulletPoint(bullet.text, bullet.label);
          });
        } else {
          addText('No detailed information available for this phase.', 9, false, [128, 128, 128]);
        }
        
        yPosition += 3;
      });
    }

    // ===== CAPTURE PATIENT LOGISTICS VISUALIZATION =====
    if (onProgress) onProgress('Capturing logistics visualization...');
    const logisticsElement = document.querySelector('.bottom-panel-logistic');
    if (logisticsElement) {
      checkNewPage(60);
      addSectionHeader('Patient Logistics & Education');
      const canvas = await html2canvas(logisticsElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      checkNewPage(imgHeight + 5);
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    }

    // ===== LOGISTICS DETAILED DATA =====
    if (onProgress) onProgress('Extracting logistics data...');
    addSectionHeader('Logistics Details');

    // Education Topics
    if (patientData.education && patientData.education.topics.length > 0) {
      addSubsectionHeader(`Education Topics (${patientData.education.completed}/${patientData.education.topics.length} completed)`);
      patientData.education.topics.forEach((topic, index) => {
        const isCompleted = index < patientData.education.completed;
        const statusText = isCompleted ? 'Completed' : 'Pending';
        const statusColor = isCompleted ? [34, 197, 94] : [239, 68, 68];
        
        checkNewPage(6);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        pdf.text(`  `, margin, yPosition);
        const prefixWidth = pdf.getTextWidth(`  `);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        const textLines = pdf.splitTextToSize(`${statusText}: ${topic}`, contentWidth - prefixWidth - 5);
        textLines.forEach((line, lineIdx) => {
          if (lineIdx === 0) {
            pdf.text(line, margin + prefixWidth, yPosition);
          } else {
            yPosition += 5;
            checkNewPage(6);
            pdf.text(line, margin + prefixWidth, yPosition);
          }
        });
        yPosition += 6;
      });
      yPosition += 3;
    }

    // Medications
    if (patientData.medications && patientData.medications.length > 0) {
      const completedMeds = patientData.medications.filter(m => m.status === 'completed').length;
      addSubsectionHeader(`Medications (${completedMeds}/${patientData.medications.length} completed)`);
      patientData.medications.forEach((med) => {
        const isCompleted = med.status === 'completed';
        const statusText = med.status.charAt(0).toUpperCase() + med.status.slice(1);
        const statusColor = isCompleted ? [34, 197, 94] : med.status === 'adjusted' ? [251, 191, 36] : [239, 68, 68];
        
        checkNewPage(6);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        pdf.text(`  `, margin, yPosition);
        const prefixWidth = pdf.getTextWidth(`  `);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        const textLines = pdf.splitTextToSize(`${statusText}: ${med.name}`, contentWidth - prefixWidth - 5);
        textLines.forEach((line, lineIdx) => {
          if (lineIdx === 0) {
            pdf.text(line, margin + prefixWidth, yPosition);
          } else {
            yPosition += 5;
            checkNewPage(6);
            pdf.text(line, margin + prefixWidth, yPosition);
          }
        });
        yPosition += 6;
      });
      yPosition += 3;
    }

    // Follow-ups
    if (patientData.followUps && patientData.followUps.length > 0) {
      const completedFollowUps = patientData.followUps.filter(f => f.completed).length;
      addSubsectionHeader(`Follow-up Arrangements (${completedFollowUps}/${patientData.followUps.length} arranged)`);
      patientData.followUps.forEach((followUp) => {
        const statusText = followUp.completed ? 'Arranged' : 'Pending';
        const statusColor = followUp.completed ? [34, 197, 94] : [239, 68, 68];
        
        checkNewPage(6);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        pdf.text(`  `, margin, yPosition);
        const prefixWidth = pdf.getTextWidth(`  `);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        const textLines = pdf.splitTextToSize(`${statusText}: ${followUp.name}`, contentWidth - prefixWidth - 5);
        textLines.forEach((line, lineIdx) => {
          if (lineIdx === 0) {
            pdf.text(line, margin + prefixWidth, yPosition);
          } else {
            yPosition += 5;
            checkNewPage(6);
            pdf.text(line, margin + prefixWidth, yPosition);
          }
        });
        yPosition += 6;
      });
      yPosition += 3;
    }

    // Caregiver Information
    if (patientData.caregiver) {
      addSubsectionHeader('Caregiver Information');
      const caregiverStatus = patientData.caregiver.status;
      const statusText = caregiverStatus === 'full' ? 'Full Support' : caregiverStatus === 'partial' ? 'Partial Support' : 'Unknown';
      const statusColor = caregiverStatus === 'full' ? [34, 197, 94] : caregiverStatus === 'partial' ? [251, 191, 36] : [128, 128, 128];
      
      addText(patientData.caregiver.text, 10);
      checkNewPage(6);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      pdf.text(`Status: ${statusText}`, margin, yPosition);
      yPosition += 7;
    }

    // ===== CAPTURE RISK TREND VISUALIZATION =====
    if (onProgress) onProgress('Capturing risk trend visualization...');
    const riskTrendElement = document.querySelector('.bottom-panel-risk');
    if (riskTrendElement) {
      checkNewPage(60);
      addSectionHeader('Risk Trend Analysis');
      const canvas = await html2canvas(riskTrendElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      checkNewPage(imgHeight + 5);
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    }

    // ===== RISK TREND DATA =====
    if (riskTrendData && riskTrendData.length > 0) {
      addSectionHeader('Risk Trend Summary');
      const initialRisk = riskTrendData[0];
      const finalRisk = riskTrendData[riskTrendData.length - 1];
      
      const weights = {
        Mobility: 0.30,
        WoundCare: 0.25,
        MedicalStability: 0.30,
        Swallowing: 0.15
      };

      const calculateRiskScore = (day) => {
        return weights.Mobility * day.Mobility +
               weights.WoundCare * day.WoundCare +
               weights.MedicalStability * day.MedicalStability +
               weights.Swallowing * day.Swallowing;
      };

      const initialScore = calculateRiskScore(initialRisk);
      const finalScore = calculateRiskScore(finalRisk);
      const riskChange = finalScore - initialScore;
      const riskText = riskChange < 0 ? 'Decreased' : riskChange > 0 ? 'Increased' : 'No change';
      const riskColor = riskChange < 0 ? [34, 197, 94] : riskChange > 0 ? [239, 68, 68] : [128, 128, 128];

      addText(`Initial Risk Score: ${initialScore.toFixed(2)} (Date: ${initialRisk.Date})`, 10);
      addText(`Final Risk Score: ${finalScore.toFixed(2)} (Date: ${finalRisk.Date})`, 10);
      checkNewPage(7);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(riskColor[0], riskColor[1], riskColor[2]);
      pdf.text(`Risk Change: ${riskText} (${riskChange >= 0 ? '+' : ''}${riskChange.toFixed(2)})`, margin, yPosition);
      yPosition += 8;
    }

    // ===== CAPTURE RADAR CHART VISUALIZATION =====
    if (onProgress) onProgress('Capturing radar chart visualization...');
    const radarElement = document.querySelector('.bottom-panel-radar');
    if (radarElement) {
      checkNewPage(60);
      addSectionHeader('Readiness Assessment');
      const canvas = await html2canvas(radarElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      checkNewPage(imgHeight + 5);
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 5;
    }

    // ===== SUMMARY SECTIONS =====
    
    // Readiness Summary
    if (readinessGrid && readinessGrid.length > 0) {
      addSectionHeader('Readiness Assessment Summary');
      const initial = readinessGrid[0];
      const final = readinessGrid[readinessGrid.length - 1];
      
      const domains = ['Mobility', 'WoundCare', 'MedicalStability', 'Swallowing', 'Education', 'SocialSupport'];
      domains.forEach((domain) => {
        const initialValue = initial[domain] || 0;
        const finalValue = final[domain] || 0;
        const change = finalValue - initialValue;
        const changeText = change > 0 ? `Increased (+${change})` : change < 0 ? `Decreased (${change})` : 'No change';
        const changeColor = change > 0 ? [34, 197, 94] : change < 0 ? [239, 68, 68] : [128, 128, 128];
        
        checkNewPage(6);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${domain}: `, margin, yPosition);
        const domainWidth = pdf.getTextWidth(`${domain}: `);
        pdf.text(`${initialValue} to ${finalValue} `, margin + domainWidth, yPosition);
        const valueWidth = pdf.getTextWidth(`${domain}: ${initialValue} to ${finalValue} `);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(changeColor[0], changeColor[1], changeColor[2]);
        pdf.text(`(${changeText})`, margin + valueWidth, yPosition);
        yPosition += 7;
      });
      yPosition += 3;
    }

    // Footer on last page
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${i} of ${totalPages} | Generated on ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    if (onProgress) onProgress('Generating PDF...');

    // Save PDF
    const fileName = `Patient_${patientNumber}_Summary_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

    if (onProgress) onProgress('Complete!');
    return true;
  } catch (error) {
    console.error('Error exporting PDF:', error);
    if (onProgress) onProgress('Error: ' + error.message);
    throw error;
  }
}
