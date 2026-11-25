# Video Demo Script - CAIDF Visualization System

## 1. Patient Information Panel

**What you see:**
This panel displays key patient demographics and admission information in a clean card format.

**What it represents:**
- Patient Name: The patient's full name
- Age/Gender: Patient's age and gender
- Admission Date: When the patient was admitted to the hospital
- Discharge Date: When the patient was discharged
- Discharge Disposition: Where the patient was sent after discharge (e.g., home, skilled nursing facility)

**Text Extraction Process:**
The system extracts this information by searching the discharge summary text for specific patterns:
- It looks for lines starting with "Patient Name:" followed by the name
- It searches for "Age/Gender:" or "Age\\/Gender:" to extract demographic information
- It finds "Admission Date:" and "Discharge Date:" patterns to get the dates
- It locates "Discharge Disposition:" to determine where the patient went after discharge
- The extraction uses regular expressions to match these patterns and parse the values that follow the colons

---

## 2. Clinical Events Timeline

**What you see:**
A horizontal line chart showing the distribution of clinical events across different phases of the patient's hospital stay. The chart displays phases from left to right: Home, ER, Unit, Discharge, and Back Home.

**What it represents:**
- The X-axis shows the timeline phases of care
- The Y-axis shows the count of clinical events in each phase
- Each dot represents a phase with its event count
- The line connects phases showing the flow of care
- Clicking on a phase or dot opens a modal with detailed events for that phase

**Text Extraction Process:**
The system uses a sophisticated phase classification algorithm:
- It reads the entire discharge summary line by line
- It classifies each line into phases using pattern matching rules:
  - **Home phase**: Matches lines about "Comorbidities", "Prior level of function", "Self-care/Caregiving", "Primary Providers"
  - **ER phase**: Matches "Overview", "Most Responsible Diagnosis", "Hospital Course"
  - **Unit phase**: Matches "Hospital Management", "Medical management", "Pain management", "Wound care", "Activities of Daily Living", "Feeding/Swallowing", and various risk assessments
  - **Discharge phase**: Matches "Discharge Plan" and related discharge planning sections
  - **Back Home phase**: Matches "Follow-Up Arrangements" and "Medications"
- It groups consecutive lines belonging to the same phase
- It counts the number of distinct clinical items (bullet points) in each phase
- The count represents the density of clinical activity in each phase

---

## 3. Patient Logistics & Education

**What you see:**
Four circular progress rings arranged in a 2x2 grid, each representing a different aspect of patient logistics:
- Education (blue gradient) - shows completion percentage
- Medication (purple gradient) - shows medication completion status
- Caregiver (pink gradient) - shows caregiver support level
- Follow-ups (yellow gradient) - shows follow-up task completion

**What it represents:**
- Each ring shows a percentage completion (0-100%)
- The icon in the center represents the category
- The percentage indicates how many items are completed versus total items
- Clicking a ring opens a detailed modal showing all items in that category

**Text Extraction Process:**
The system extracts logistics data using targeted pattern matching:
- **Education**: Searches for text between "Education:" and "Follow-Up" sections. Splits the content by commas, periods, or newlines to extract individual education topics. Counts completed topics (assumes 70% completion rate based on keywords like "reviewed" or "taught")
- **Medications**: Finds the "Medications:" section and extracts each medication by splitting on commas, periods, or newlines. Determines status based on keywords: "reduced" = adjusted, "during stay" = completed, otherwise = active
- **Caregiver**: Locates "Self-care/Caregiving:" section. Determines status from keywords: "24/7" = full support, "checks in frequently" = partial support, otherwise = unknown
- **Follow-ups**: Extracts text between "Follow-Up Arrangements" and "Medications:". Splits into individual follow-up tasks. Marks as completed if text contains "arranged" or "clinic"

---

## 4. Patient Discharge Risk Trend

**What you see:**
A line graph showing the patient's discharge risk score over time. The graph has:
- X-axis: Days/dates from admission to discharge
- Y-axis: Risk score from 0 (low risk) to 3 (high risk)
- Colored line segments: Green for low risk (0-0.5), Orange for medium risk (0.5-1.5), Red for high risk (1.5-3.0)
- Data points: Circles at each day showing the risk score
- Toggle button: Switch between 2D line chart and 3D terrain visualization

**What it represents:**
- The trend shows how the patient's discharge risk changes over their hospital stay
- Risk typically starts high at admission and decreases as the patient improves
- The score is a weighted average of four risk domains: Mobility (30%), WoundCare (25%), MedicalStability (30%), and Swallowing (15%)
- Lower scores near discharge indicate the patient is ready to be discharged safely

**Text Extraction Process:**
The system extracts risk data using context-aware analysis:
- **Date Range**: Extracts admission and discharge dates, then generates all dates in between
- **Domain-Specific Risk Calculation**: For each day and each domain (Mobility, WoundCare, MedicalStability, Swallowing), it:
  - Analyzes the entire discharge summary text for domain-specific keywords
  - Checks specific sections: "Hospital Management", "Discharge Plan", "Hospital Course"
  - Uses keyword matching to determine risk level:
    - **Mobility**: Looks for "unsafe for ambulation", "unable to transfer", "bedbound" (high risk) vs "independent", "walker", "cane" (low risk)
    - **WoundCare**: Searches for "wound", "ulcer", "infection" (high risk) vs "healing", "improved" (low risk)
    - **MedicalStability**: Finds "hypokalemic", "respiratory failure", "ICU" (high risk) vs "stable", "resolved" (low risk)
    - **Swallowing**: Detects "aspiration", "dysphagia", "tube feeds" (high risk) vs "regular diet", "no restrictions" (low risk)
  - Calculates risk progression: Risk starts high at admission and decreases over time, reaching near 0 at discharge
  - Uses time-based progression: Early days have higher risk, later days have lower risk based on the progress through the stay
- **Weighted Score**: Combines the four domain scores using weights to create a single daily risk score

---

## 5. Readiness Radar Chart

**What you see:**
A radar/spider chart with six axes representing different readiness domains:
- Mobility
- Wound Care
- Medical Stability
- Swallowing
- Education
- Social Support

Each axis has a scale from 0 to 3, where:
- 0 = Severe deficit / needs full support
- 1 = Significant issues / major assistance
- 2 = Some limitations / partially independent
- 3 = Ready / independent

**What it represents:**
- The polygon shape shows the patient's readiness profile
- Larger polygon = better readiness across all domains
- You can view Initial, Progress, Final, or All time points
- Different colors represent different time points: Red (Initial), Blue (Progress), Green (Final)
- The chart shows how readiness improves over time

**Text Extraction Process:**
The system extracts readiness scores using similar domain analysis as risk trend:
- **Date Range**: Same date extraction as risk trend (admission to discharge)
- **Domain-Specific Readiness**: For each day and each of the 6 domains, it:
  - Analyzes the discharge summary for domain-specific indicators
  - **Mobility**: Extracts from mentions of mobility assistance levels, transfer ability, ambulation status
  - **WoundCare**: Determines from wound mentions, healing progress, infection status
  - **MedicalStability**: Assesses from vital signs, medical condition stability, resolution of issues
  - **Swallowing**: Evaluates from diet restrictions, swallowing evaluations, aspiration risk
  - **Education**: Checks for education provided, topics covered, completion status
  - **SocialSupport**: Analyzes caregiver availability, support systems, family involvement
- **Progression Logic**: Readiness scores start low (0-1) and improve over time, reaching higher values (2-3) near discharge
- **Time Point Selection**: The chart can show:
  - Initial: First day's readiness scores
  - Progress: Middle of stay readiness scores
  - Final: Last day's readiness scores
  - All: Overlays all time points with different colors

---

## Summary of Text Extraction Techniques

All visualizations use a combination of:
1. **Pattern Matching**: Regular expressions to find specific sections and labels
2. **Keyword Analysis**: Searching for domain-specific medical terminology
3. **Context Awareness**: Analyzing surrounding text and sections for better accuracy
4. **Time-Based Progression**: Using day index and total days to model improvement over time
5. **Section Parsing**: Breaking the discharge summary into logical sections (Hospital Management, Discharge Plan, Hospital Course, etc.)
6. **Phase Classification**: Grouping clinical events into care phases (Home, ER, Unit, Discharge, Back Home)

The extraction algorithms are designed to work with real hospital discharge summaries and adapt to variations in formatting and terminology.


