// usePatientData.js
import { useState, useEffect, useMemo, useCallback } from "react";
import * as d3 from "d3";
import patient1Data from "../data/Patient1.txt";
import patient2Data from "../data/Patient2.txt";

/**
 * Parses raw patient notes into structured events grouped by hospital phase.
 * Fetches the discharge summary from the text file.
 */
export function usePatientData(patientNumber = 1) {
  const [rawNote, setRawNote] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch the discharge summary text file based on patient number
  useEffect(() => {
    const patientFile = patientNumber === 1 ? patient1Data : patient2Data;
    setLoading(true);
    fetch(patientFile)
      .then((res) => res.text())
      .then((text) => {
        setRawNote(text.trim());
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading discharge summary:", err);
        setLoading(false);
      });
  }, [patientNumber]);

  // === Define hospital phases and classification rules ===
  // Memoize phases since it's a constant array
  const phases = useMemo(() => [
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
        /^Risk for /i,  // Risk assessments (Risk for aspiration, Risk for thrombosis, etc.)
        /^Decreased /i,  // Decreased cardiac output, etc.
        /^Impaired /i,  // Impaired urinary elimination, Impaired skin integrity, etc.
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
  ], []);

  // Memoize classify function since it depends on phases
  const classify = useMemo(() => (line) => {
    const hit = phases.find((p) => p.rules.some((re) => re.test(line)));
    if (hit) return hit.key;
    // fallback if nothing matched
    return /Hospital Management/i.test(line) ? "unit" : "home";
  }, [phases]);

  // Process sections from rawNote - memoized to avoid recalculation
  const sectionsRaw = useMemo(() => {
    if (!rawNote) return [];

    const lines = String(rawNote)
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    // Expand "Hospital Management" into individual "Label: content" lines (keep header)
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

    // Track if we're in a discharge plan section
    let inDischargePlan = false;

    const rows = [];
    for (let i = 0; i < expanded.length; i++) {
      const line = expanded[i];

      // Check if we've entered discharge plan section
      if (/^Discharge Plan:?/i.test(line)) {
        inDischargePlan = true;
      }
      // Check if we've left discharge plan section
      if (/^(Follow-?Up Arrangements|Medications):?/i.test(line)) {
        inDischargePlan = false;
      }

      // Special header whose value is on next line
      if (headersNoColon.some((re) => re.test(line))) {
        const next = (expanded[i + 1] || "").replace(/^[–—-]\s*/, "").trim();
        // If in discharge plan, classify as discharge, otherwise use normal classification
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
      // If in discharge plan section and line matches discharge patterns, classify as discharge
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

    return rows;
  }, [rawNote, classify]);

  const sections = useMemo(() => {
    if (!sectionsRaw.length) return [];

    const byPhase = d3.group(sectionsRaw, (d) => d.phase);
    const merged = [];

    for (const p of phases) {
      const items = byPhase.get(p.key) || [];
      if (!items.length) continue;

      // Base count = all rows the parser found in this phase
      let count = items.length;

      // Patient info never contributes weight
      if (p.key === "patient_info" || p.key === "nah") count = 0;

      // Back_Home: do NOT subtract here; just remember if a Medications row exists
      const hasMeds =
        p.key === "back_home" &&
        items.some((d) => /^\s*Medications?\b/i.test((d.label || "").trim()));

      merged.push({
        id: `merged_${p.key}`,
        phase: p.key,
        label: p.label,
        // keep all bullets as readable block
        content: items.map((d) => `• ${d.label}: ${d.content}`).join("\n"),
        count, // full count (no subtraction)
        hasMeds, // <-- used later in buildEvents({ includeMeds })
      });
    }

    return merged;
  }, [sectionsRaw, phases]);

  // Memoize buildEvents function
  const buildEventsMemo = useCallback((phases, sections, { includeMeds = false } = {}) => {
    // ordinal positions for the coarse time ordering (later replaced by visual centers)
    const order = Object.fromEntries(phases.map((p) => [p.key, p.order ?? 0]));

    // how much each merged phase contributes to density
    const weightFor = (s) => {
      // never weight patient-info / unknown
      if (s.phase === "patient_info" || s.phase === "nah") return 0;

      // Back_Home:
      // - sections[].count is the full number of bullets (no subtraction)
      // - sections[].hasMeds tells us whether a "Medications" bullet exists
      if (s.phase === "back_home") {
        const base = s.count ?? 0;
        return includeMeds ? base : Math.max(0, base - (s.hasMeds ? 1 : 0));
      }

      // Discharge: drop the generic header bullet if present
      if (s.phase === "discharge") {
        const genericHeader =
          /(?:^|\n)•\s*Discharge\s*Plan:\s*Discharge\s*Plan\b/i.test(
            s.content || ""
          ) ||
          (/^Discharge\s*Plan$/i.test(s.label || "") &&
            /^Discharge\s*Plan$/i.test(s.content || ""));
        const base = s.count ?? 0;
        return Math.max(0, base - (genericHeader ? 1 : 0));
      }

      // All other phases: use the merged count as-is
      return s.count ?? 0;
    };

    // build event records; ts will later be replaced by visual centers in drawChart()
    return sections.map((s) => ({
      id: s.id,
      phase: s.phase,
      phaseLabel: s.label,
      text: `${s.label}\n${s.content}`,
      value: Math.max(0, weightFor(s)),
      idx: 0,
      ts: (order[s.phase] ?? 0) * 1000,
    }));
  }, []);

  const events = useMemo(
    () => (sections.length ? buildEventsMemo(phases, sections, { includeMeds: false }) : []),
    [sections, phases, buildEventsMemo]
  );

  const eventsWithMeds = useMemo(
    () => (sections.length ? buildEventsMemo(phases, sections, { includeMeds: true }) : []),
    [sections, phases, buildEventsMemo]
  );

  console.log("Data loaded:", { phases, sections, events, eventsWithMeds, loading });
  return { phases, sections, events, eventsWithMeds, loading };
}
