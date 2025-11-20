/**
 * Extracts risk trend data from patient discharge summary
 * Returns data in format: [{ Date: "5/4", Mobility: 3, WoundCare: 2, ... }, ...]
 * Higher values = higher risk (0 = low risk, 3 = high risk)
 * Risk decreases over time, reaching near 0 at discharge
 */

export function extractRiskTrendData(dischargeText) {
  // Extract dates
  const admissionMatch = dischargeText.match(/Admission Date:\s*(\d+\/\d+)/i);
  const dischargeMatch = dischargeText.match(/Discharge Date:\s*(\d+\/\d+)/i);
  
  if (!admissionMatch || !dischargeMatch) {
    return [];
  }

  const admissionDate = admissionMatch[1];
  const dischargeDate = dischargeMatch[1];

  // Parse dates (format: M/D)
  const parseDate = (dateStr) => {
    const [month, day] = dateStr.split('/').map(Number);
    return { month, day };
  };

  const start = parseDate(admissionDate);
  const end = parseDate(dischargeDate);

  // Generate date range
  const dates = [];
  let currentMonth = start.month;
  let currentDay = start.day;
  
  // Days per month (simplified - doesn't account for leap years)
  const daysInMonth = (month) => {
    const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[month - 1] || 31;
  };
  
  while (currentMonth < end.month || (currentMonth === end.month && currentDay <= end.day)) {
    dates.push(`${currentMonth}/${currentDay}`);
    currentDay++;
    
    // Handle month overflow
    if (currentDay > daysInMonth(currentMonth)) {
      currentMonth++;
      currentDay = 1;
    }
    
    // Safety check to prevent infinite loops
    if (currentMonth > 12 || (currentMonth > end.month && currentDay > end.day)) {
      break;
    }
  }

  // Analyze patient data for risk assessment
  const text = dischargeText.toLowerCase();

  // Extract sections for context-aware analysis
  const hospitalManagementMatch = dischargeText.match(/Hospital Management:?(.*?)(?:Discharge Plan|$)/is);
  const hospitalManagementText = hospitalManagementMatch ? hospitalManagementMatch[1].toLowerCase() : "";
  
  const dischargePlanMatch = dischargeText.match(/Discharge Plan:?(.*?)(?:Follow-Up|Education|Medications|$)/is);
  const dischargePlanText = dischargePlanMatch ? dischargePlanMatch[1].toLowerCase() : "";
  
  const hospitalCourseMatch = dischargeText.match(/Hospital Course:?(.*?)(?:Prior level|Self-care|$)/is);
  const hospitalCourseText = hospitalCourseMatch ? hospitalCourseMatch[1].toLowerCase() : "";

  // Helper to determine risk level (3 = high risk, 0 = low risk) based on keywords and context
  // Risk should decrease over time, reaching near 0 at discharge
  const getRiskLevel = (domain, dayIndex, totalDays) => {
    let riskScore = 3; // Start with high risk
    // Progress: 1.0 at admission (day 0), 0.0 at discharge (last day)
    const progress = (totalDays - 1 - dayIndex) / Math.max(1, totalDays - 1); // 1.0 to 0.0
    const isNearDischarge = progress < 0.15; // Last ~15% of stay
    const isDischargeDay = dayIndex === totalDays - 1;
    
    // Check all relevant sections
    const allText = text;
    const mgmtText = hospitalManagementText;
    const dcPlanText = dischargePlanText;
    const courseText = hospitalCourseText;
    
    // Domain-specific risk extraction logic
    switch(domain) {
      case "Mobility":
        // High risk indicators early on
        if (allText.includes('unsafe for ambulation') || 
            allText.includes('unable to transfer') ||
            allText.includes('bedbound') ||
            allText.includes('2 person assist')) {
          if (isDischargeDay) {
            riskScore = 0; // Ready for discharge
          } else if (isNearDischarge) {
            riskScore = progress < 0.08 ? 0 : 0.5; // Very low risk near discharge
          } else {
            riskScore = progress > 0.7 ? 3 : progress > 0.4 ? 2 : 1.5;
          }
        }
        // Moderate assistance
        else if (allText.includes('minimum assistance') ||
                 allText.includes('moderate assistance') ||
                 allText.includes('wheelchair') ||
                 allText.includes('rolling walker') ||
                 allText.includes('standby assist')) {
          if (mgmtText.includes('functional mobility') || mgmtText.includes('adl training') || mgmtText.includes('transfer training')) {
            if (isDischargeDay) {
              riskScore = 0;
            } else if (isNearDischarge) {
              riskScore = progress < 0.1 ? 0 : 0.5;
            } else {
              riskScore = progress > 0.6 ? 2.5 : progress > 0.3 ? 2 : 1.5;
            }
          } else {
            if (isDischargeDay) {
              riskScore = 0.5;
            } else {
              riskScore = progress > 0.5 ? 2 : 1.5;
            }
          }
        }
        // Better mobility indicators
        else if (allText.includes('moderately independent') ||
                 allText.includes('independent') ||
                 allText.includes('walker') ||
                 allText.includes('cane') ||
                 allText.includes('ambulation')) {
          if (dcPlanText.includes('mobility') || dcPlanText.includes('exercise program') || dcPlanText.includes('hep')) {
            if (isDischargeDay) {
              riskScore = 0;
            } else {
              riskScore = progress > 0.4 ? 1.5 : progress > 0.2 ? 1 : 0.5;
            }
          } else {
            if (isDischargeDay) {
              riskScore = 0;
            } else {
              riskScore = progress > 0.3 ? 1.5 : progress > 0.15 ? 0.8 : 0.3;
            }
          }
        }
        // Default progression - risk decreases over time
  else {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = Math.max(0, progress * 2.5);
          }
        }
        break;
        
      case "WoundCare":
  // Check for wound mentions
        if (!allText.includes('wound') && !allText.includes('ulcer') && !allText.includes('dressing')) {
          riskScore = 0; // No wound = no risk at any time
          break;
        }
        
        // New wound or infection = high risk initially
        if (courseText.includes('new wound') || 
            allText.includes('infection') ||
            allText.includes('pressure ulcer')) {
          if (isDischargeDay) {
            riskScore = 0; // Managed by discharge
          } else if (isNearDischarge) {
            riskScore = progress < 0.1 ? 0 : 0.8;
          } else {
            riskScore = progress > 0.7 ? 3 : progress > 0.4 ? 2 : 1.5;
          }
        }
        // Wound care initiated
        else if (mgmtText.includes('wound care initiated') || 
                 mgmtText.includes('dressing') ||
                 mgmtText.includes('no infection')) {
          if (dcPlanText.includes('wound clinic') || dcPlanText.includes('wound care')) {
            if (isDischargeDay) {
              riskScore = 0;
            } else if (isNearDischarge) {
              riskScore = progress < 0.12 ? 0 : 1;
            } else {
              riskScore = progress > 0.5 ? 2 : progress > 0.2 ? 1.5 : 1;
            }
          } else {
            if (isDischargeDay) {
              riskScore = 0.5;
            } else {
              riskScore = progress > 0.4 ? 1.8 : 1.2;
            }
          }
        }
        // Healing/improving
        else if (allText.includes('healing') || allText.includes('improved')) {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = progress > 0.3 ? 1.5 : progress > 0.1 ? 0.8 : 0.2;
          }
        }
        // Default - risk decreases
  else {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = Math.max(0, progress * 2 + 0.5);
          }
        }
        break;
        
      case "MedicalStability":
        // High risk indicators early
        if (courseText.includes('hypokalemic') ||
            courseText.includes('hypomagnesemic') ||
            courseText.includes('electrolyte abnormalities') ||
            courseText.includes('acute kidney injury') ||
            allText.includes('respiratory failure') ||
            allText.includes('icu') ||
            allText.includes('rapid response')) {
          if (mgmtText.includes('medical management') || mgmtText.includes('electrolyte')) {
            if (isDischargeDay) {
              riskScore = 0;
            } else if (isNearDischarge) {
              riskScore = progress < 0.1 ? 0 : 0.8;
            } else {
              riskScore = progress > 0.7 ? 3 : progress > 0.4 ? 2 : 1.5;
            }
          } else {
            if (isDischargeDay) {
              riskScore = 0.5;
            } else {
              riskScore = progress > 0.6 ? 2.5 : 1.8;
            }
          }
        }
        // Stabilizing
        else if (mgmtText.includes('stable') ||
                 mgmtText.includes('improved') ||
                 mgmtText.includes('resolved') ||
                 mgmtText.includes('controlled')) {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = progress > 0.5 ? 1.8 : progress > 0.2 ? 1 : 0.5;
          }
        }
        // Baseline/stable
        else if (allText.includes('baseline') || allText.includes('stable')) {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = progress > 0.4 ? 1.5 : progress > 0.1 ? 0.8 : 0.2;
          }
        }
        // Default - risk decreases
  else {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = Math.max(0, progress * 2.5);
          }
        }
        break;
        
      case "Swallowing":
        // High risk early
        if (allText.includes('aspiration') ||
            allText.includes('dysphagia') ||
            allText.includes('tube feeds') ||
            allText.includes('npo')) {
          if (isDischargeDay) {
            riskScore = 0;
          } else if (isNearDischarge) {
            riskScore = progress < 0.1 ? 0 : 1;
          } else {
            riskScore = progress > 0.7 ? 3 : progress > 0.4 ? 2 : 1.5;
          }
        }
        // Evaluation and precautions
        else if (mgmtText.includes('swallowing') || 
                 mgmtText.includes('feeding') ||
                 mgmtText.includes('swallow eval') ||
                 mgmtText.includes('diet')) {
          if (allText.includes('puree') || allText.includes('soft') || allText.includes('precautions')) {
            if (dcPlanText.includes('swallowing') || dcPlanText.includes('diet')) {
              if (isDischargeDay) {
                riskScore = 0;
              } else if (isNearDischarge) {
                riskScore = progress < 0.12 ? 0 : 1;
              } else {
                riskScore = progress > 0.5 ? 2 : progress > 0.2 ? 1.5 : 1;
              }
            } else {
              if (isDischargeDay) {
                riskScore = 0.5;
              } else {
                riskScore = progress > 0.4 ? 1.8 : 1.2;
              }
            }
          }
          // Thin liquids / regular diet
          else if (allText.includes('thin liquids') || allText.includes('regular diet') || allText.includes('no restrictions')) {
            if (isDischargeDay) {
              riskScore = 0;
            } else {
              riskScore = progress > 0.3 ? 1.5 : progress > 0.1 ? 0.8 : 0.2;
            }
          } else {
            if (isDischargeDay) {
              riskScore = 0.5;
            } else {
              riskScore = progress > 0.4 ? 1.8 : 1.2;
            }
          }
        }
        // Default - risk decreases
  else {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = Math.max(0, progress * 2.5);
          }
        }
        break;
        
      case "Education":
        // Education risk is lower overall - missing education is a risk
        if (dcPlanText.includes('education') || allText.includes('education:')) {
          if (allText.includes('reviewed') || allText.includes('taught') || allText.includes('instructed')) {
            // Education provided - risk decreases
            if (isDischargeDay) {
              riskScore = 0;
            } else {
              riskScore = progress > 0.5 ? 2 : progress > 0.2 ? 1 : 0.5;
            }
          } else {
            if (isDischargeDay) {
              riskScore = 0.5;
            } else {
              riskScore = progress > 0.4 ? 1.5 : 1;
            }
          }
        }
        // Default progression - lower risk overall
        else {
          if (isDischargeDay) {
            riskScore = 0.3;
          } else {
            riskScore = Math.max(0, progress * 1.5);
          }
        }
        break;
        
      case "SocialSupport":
        // High risk - no support (this stays constant)
        if (allText.includes('no caregiver') || allText.includes('lives alone') || allText.includes('no family')) {
          // Even with no support, if patient is being discharged, risk is lower (managed by discharge planning)
          riskScore = isDischargeDay ? 1 : 2.5;
        }
        // Partial support
        else if (allText.includes('caregiver') && 
                 (allText.includes('checks in') || allText.includes('does not live'))) {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = progress > 0.5 ? 2 : progress > 0.2 ? 1.5 : 1;
          }
  }
  // Full support
        else if (allText.includes('24/7') ||
                 allText.includes('full supervision') ||
                 allText.includes('social work arranged') ||
                 dcPlanText.includes('supervision')) {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = progress > 0.4 ? 1.5 : progress > 0.2 ? 1 : 0.5;
          }
        }
        // Family/caregiver mentioned
        else if (allText.includes('caregiver') || allText.includes('family')) {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = progress > 0.5 ? 1.8 : progress > 0.2 ? 1.2 : 0.6;
          }
        }
        // Default - risk decreases
  else {
          if (isDischargeDay) {
            riskScore = 0;
          } else {
            riskScore = Math.max(0, progress * 2);
          }
        }
        break;
        
      default:
        // Default progression for unknown domains - risk decreases
        riskScore = isDischargeDay ? 0 : Math.max(0, progress * 2);
        break;
    }
    
    // Round to 1 decimal and clamp between 0-3
    return Math.max(0, Math.min(3, Math.round(riskScore * 10) / 10));
  };

  // Generate grid data with domain-specific risk extraction based on actual patient data
  const domains = ["Mobility", "WoundCare", "MedicalStability", "Swallowing", "Education", "SocialSupport"];
  
  const grid = dates.map((date, index) => {
    const row = { Date: date };
    
    // Extract risk for each domain - risk decreases over time, near 0 at discharge
    domains.forEach(domain => {
      const risk = getRiskLevel(domain, index, dates.length);
      row[domain] = risk;
    });
    
    return row;
  });
  
  console.log("Extracted Risk Trend Grid:", grid);
  return grid;
}
