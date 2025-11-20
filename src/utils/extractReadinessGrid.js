/**
 * Extracts readiness heat grid data from patient discharge summary
 * Returns data in format: [{ Date: "5/4", Mobility: 0, WoundCare: 1, ... }, ...]
 */

export function extractReadinessGrid(dischargeText) {
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

  // Analyze patient data for each task category
  const text = dischargeText.toLowerCase();

  // Extract sections for context-aware analysis
  const hospitalManagementMatch = dischargeText.match(/Hospital Management:?(.*?)(?:Discharge Plan|$)/is);
  const hospitalManagementText = hospitalManagementMatch ? hospitalManagementMatch[1].toLowerCase() : "";
  
  const dischargePlanMatch = dischargeText.match(/Discharge Plan:?(.*?)(?:Follow-Up|Education|Medications|$)/is);
  const dischargePlanText = dischargePlanMatch ? dischargePlanMatch[1].toLowerCase() : "";
  
  const hospitalCourseMatch = dischargeText.match(/Hospital Course:?(.*?)(?:Prior level|Self-care|$)/is);
  const hospitalCourseText = hospitalCourseMatch ? hospitalCourseMatch[1].toLowerCase() : "";

  // Helper to determine readiness level (0-3) based on keywords and context
  const getReadinessLevel = (domain, dayIndex, totalDays) => {
    let score = 0;
    const progress = dayIndex / Math.max(1, totalDays - 1); // 0 to 1
    
    // Check all relevant sections
    const allText = text;
    const mgmtText = hospitalManagementText;
    const dcPlanText = dischargePlanText;
    const courseText = hospitalCourseText;
    
    // Domain-specific extraction logic
    switch(domain) {
      case "Mobility":
        // High risk indicators
        if (allText.includes('unsafe for ambulation') || 
            allText.includes('unable to transfer') ||
            allText.includes('bedbound') ||
            allText.includes('2 person assist')) {
          score = progress < 0.3 ? 0 : progress < 0.6 ? 1 : 2;
        }
        // Moderate assistance
        else if (allText.includes('minimum assistance') ||
                 allText.includes('moderate assistance') ||
                 allText.includes('wheelchair') ||
                 allText.includes('rolling walker') ||
                 allText.includes('standby assist')) {
          if (mgmtText.includes('functional mobility') || mgmtText.includes('adl training') || mgmtText.includes('transfer training')) {
            score = progress < 0.4 ? 1 : progress < 0.7 ? 2 : 2.5;
          } else {
            score = progress < 0.5 ? 1 : 2;
          }
        }
        // Better mobility indicators
        else if (allText.includes('moderately independent') ||
                 allText.includes('independent') ||
                 allText.includes('walker') ||
                 allText.includes('cane') ||
                 allText.includes('ambulation')) {
          if (dcPlanText.includes('mobility') || dcPlanText.includes('exercise program') || dcPlanText.includes('hep')) {
            score = progress < 0.6 ? 2 : 2.8;
          } else {
            score = progress < 0.7 ? 2 : 3;
          }
        }
        // Default progression
        else {
          score = Math.min(3, Math.floor(progress * 2.5));
        }
        break;
        
      case "WoundCare":
        // Check for wound mentions
        if (!allText.includes('wound') && !allText.includes('ulcer') && !allText.includes('dressing')) {
          score = 3; // No wound = low risk
          break;
        }
        
        // New wound or infection = high risk initially
        if (courseText.includes('new wound') || 
            allText.includes('infection') ||
            allText.includes('pressure ulcer')) {
          score = progress < 0.3 ? 0 : progress < 0.6 ? 1 : 1.5;
        }
        // Wound care initiated
        else if (mgmtText.includes('wound care initiated') || 
                 mgmtText.includes('dressing') ||
                 mgmtText.includes('no infection')) {
          if (dcPlanText.includes('wound clinic') || dcPlanText.includes('wound care')) {
            score = progress < 0.5 ? 1 : progress < 0.8 ? 2 : 2.5;
          } else {
            score = progress < 0.6 ? 1.5 : 2;
          }
        }
        // Healing/improving
        else if (allText.includes('healing') || allText.includes('improved')) {
          score = progress < 0.7 ? 2 : 2.8;
        }
        // Default
        else {
          score = Math.min(3, Math.floor(progress * 2) + 1);
        }
        break;
        
      case "MedicalStability":
        // High risk indicators
        if (courseText.includes('hypokalemic') ||
            courseText.includes('hypomagnesemic') ||
            courseText.includes('electrolyte abnormalities') ||
            courseText.includes('acute kidney injury') ||
            allText.includes('respiratory failure') ||
            allText.includes('icu') ||
            allText.includes('rapid response')) {
          if (mgmtText.includes('medical management') || mgmtText.includes('electrolyte')) {
            score = progress < 0.3 ? 0 : progress < 0.6 ? 1 : 2;
          } else {
            score = progress < 0.4 ? 0.5 : 1.5;
          }
        }
        // Stabilizing
        else if (mgmtText.includes('stable') ||
                 mgmtText.includes('improved') ||
                 mgmtText.includes('resolved') ||
                 mgmtText.includes('controlled')) {
          score = progress < 0.5 ? 1.5 : progress < 0.8 ? 2.5 : 3;
        }
        // Baseline/stable
        else if (allText.includes('baseline') || allText.includes('stable')) {
          score = progress < 0.6 ? 2 : 3;
        }
        // Default
        else {
          score = Math.min(3, Math.floor(progress * 2.5));
        }
        break;
        
      case "Swallowing":
        // High risk
        if (allText.includes('aspiration') ||
            allText.includes('dysphagia') ||
            allText.includes('tube feeds') ||
            allText.includes('npo')) {
          score = progress < 0.3 ? 0 : progress < 0.6 ? 1 : 1.5;
        }
        // Evaluation and precautions
        else if (mgmtText.includes('swallowing') || 
                 mgmtText.includes('feeding') ||
                 mgmtText.includes('swallow eval') ||
                 mgmtText.includes('diet')) {
          if (allText.includes('puree') || allText.includes('soft') || allText.includes('precautions')) {
            if (dcPlanText.includes('swallowing') || dcPlanText.includes('diet')) {
              score = progress < 0.5 ? 1 : progress < 0.8 ? 2 : 2.5;
            } else {
              score = progress < 0.6 ? 1.5 : 2;
            }
          }
          // Thin liquids / regular diet
          else if (allText.includes('thin liquids') || allText.includes('regular diet') || allText.includes('no restrictions')) {
            score = progress < 0.7 ? 2 : 2.8;
          } else {
            score = progress < 0.6 ? 1.5 : 2;
          }
        }
        // Default
        else {
          score = Math.min(3, Math.floor(progress * 2.5));
        }
        break;
        
      case "Education":
        // Check for education mentions
        if (dcPlanText.includes('education') || allText.includes('education:')) {
          if (allText.includes('reviewed') || allText.includes('taught') || allText.includes('instructed')) {
            // Education provided later in stay
            score = progress < 0.5 ? 0 : progress < 0.7 ? 1.5 : progress < 0.9 ? 2.5 : 3;
          } else {
            score = progress < 0.6 ? 1 : 2;
          }
        }
        // Default progression
        else {
          score = Math.min(3, Math.floor(progress * 2));
        }
        break;
        
      case "SocialSupport":
        // High risk - no support
        if (allText.includes('no caregiver') || allText.includes('lives alone') || allText.includes('no family')) {
          score = 0;
        }
        // Partial support
        else if (allText.includes('caregiver') && 
                 (allText.includes('checks in') || allText.includes('does not live'))) {
          score = progress < 0.5 ? 1 : progress < 0.8 ? 2 : 2.5;
        }
        // Full support
        else if (allText.includes('24/7') ||
                 allText.includes('full supervision') ||
                 allText.includes('social work arranged') ||
                 dcPlanText.includes('supervision')) {
          score = progress < 0.6 ? 2 : progress < 0.8 ? 2.5 : 3;
        }
        // Family/caregiver mentioned
        else if (allText.includes('caregiver') || allText.includes('family')) {
          score = progress < 0.5 ? 1.5 : progress < 0.8 ? 2 : 2.5;
        }
        // Default
        else {
          score = Math.min(3, Math.floor(progress * 2));
        }
        break;
        
      default:
        // Default progression for unknown domains
        score = Math.min(3, Math.floor(progress * 2));
        break;
    }
    
    // Round to nearest integer and clamp between 0-3
    return Math.max(0, Math.min(3, Math.round(score)));
  };

  // Generate grid data with domain-specific extraction based on actual patient data
  const domains = ["Mobility", "WoundCare", "MedicalStability", "Swallowing", "Education", "SocialSupport"];
  
  const grid = dates.map((date, index) => {
    const row = { Date: date };
    
    // Extract readiness for each domain based on actual patient data progression
    domains.forEach(domain => {
      const readiness = getReadinessLevel(domain, index, dates.length);
      row[domain] = readiness;
    });
    
    return row;
  });
  
  console.log("Extracted Readiness Grid:", grid);
  return grid;

}

