import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { extractPatientData } from "../utils/extract";
import patient1Data from "../data/Patient1.txt";
import patient2Data from "../data/Patient2.txt";
import CommonModal from "./CommonModal";
import "./PatientLogistic.css";

export default function PatientLogistic({ patientNumber = 1 }) {
  const ref = useRef();
  const [showModal, setShowModal] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const patientFile = patientNumber === 1 ? patient1Data : patient2Data;
    fetch(patientFile)
      .then((res) => res.text())
      .then((text) => setData(extractPatientData(text)));
  }, [patientNumber]);

  useEffect(() => {
    if (!data) return;

    const container = ref.current?.parentElement;
    if (!container) return;

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const containerWidth = container.clientWidth || 400;
    const containerHeight = container.clientHeight || 400;
    const width = containerWidth;
    const height = containerHeight;
    const margin = { top: 15, left: 12, right: 12, bottom: 12 };
    const textColor = "#e2e8f0";

    const colors = {
      Education: "url(#gradEdu)",
      Medication: "url(#gradMed)",
      Caregiver: "url(#gradCare)",
      "Follow-ups": "url(#gradFollow)",
    };

    const sections = [
      {
        label: "Education",
        progress: data.education.topics.length
          ? data.education.completed / data.education.topics.length
          : 0,
        completed: data.education.completed,
        total: data.education.topics.length,
        description: "View education topics and completion status",
      },
      {
        label: "Medication",
        progress: data.medications.length
          ? data.medications.filter((m) => m.status === "completed").length /
            data.medications.length
          : 0,
        completed: data.medications.filter((m) => m.status === "completed").length,
        total: data.medications.length,
        description: "View medication list and completion status",
      },
      {
        label: "Caregiver",
        progress:
          data.caregiver.status === "full"
            ? 1
            : data.caregiver.status === "partial"
            ? 0.6
            : 0.3,
        completed: data.caregiver.status === "full" ? 1 : data.caregiver.status === "partial" ? 1 : 0,
        total: 1,
        description: "View caregiver information and status",
      },
      {
        label: "Follow-ups",
        progress: data.followUps.length
          ? data.followUps.filter((f) => f.completed).length /
            data.followUps.length
          : 0,
        completed: data.followUps.filter((f) => f.completed).length,
        total: data.followUps.length,
        description: "View follow-up tasks and completion status",
      },
    ];

    // --- Gradient Definitions ---
    const defs = svg.append("defs");

    const gradients = [
      { id: "gradEdu", from: "#60a5fa", to: "#3b82f6" },
      { id: "gradMed", from: "#34d399", to: "#059669" },
      { id: "gradCare", from: "#f472b6", to: "#db2777" },
      { id: "gradFollow", from: "#facc15", to: "#eab308" },
    ];

    gradients.forEach((g) => {
      const grad = defs
        .append("linearGradient")
        .attr("id", g.id)
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");
      grad.append("stop").attr("offset", "0%").attr("stop-color", g.from);
      grad.append("stop").attr("offset", "100%").attr("stop-color", g.to);
    });

    // Create tooltip element first
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "logistic-tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("z-index", 10001);

    // Calculate title height
    const titleHeight = 20; // Title text height
    const titleMargin = 12; // Space after title
    
    // --- Render Title ---
    let y = margin.top;
    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", y)
      .text("🧾 Patient Logistics & Education")
      .style("fill", "#fcfcfcff")
      .style("font-size", "15px")
      .style("font-weight", "700");

    y += titleHeight + titleMargin;

    // Calculate available height for sections
    const sectionAreaTop = y;
    const sectionAreaBottom = height - margin.bottom;
    const availableHeightForSections = sectionAreaBottom - sectionAreaTop;
    
    // Calculate spacing - each section needs space for label (6px) + gap (6px) + bar (14px) + spacing
    const sectionCount = sections.length;
    const minSectionHeight = 28; // Minimum: label(6) + gap(6) + bar(14) + spacing(2)
    const maxSectionHeight = 40;
    
    // Calculate optimal spacing to fill available height
    let sectionHeight = availableHeightForSections / sectionCount;
    sectionHeight = Math.max(minSectionHeight, Math.min(maxSectionHeight, sectionHeight));
    
    // Adjust spacing based on calculated section height
    const sectionSpacing = sectionHeight;
    
    // --- Render Progress Bars ---
    sections.forEach((sec, i) => {
      const group = svg
        .append("g")
        .style("cursor", "pointer")
        .on("click", () => setShowModal(sec.label));

      group
        .append("text")
        .attr("x", margin.left)
        .attr("y", y)
        .text(sec.label)
        .style("fill", textColor)
        .style("font-size", "13px")
        .style("font-weight", "600");

      y += 6;

      const barWidth = width - margin.left - margin.right - 50;
      const barHeight = 14;

      group
        .append("rect")
        .attr("x", margin.left)
        .attr("y", y)
        .attr("width", barWidth)
        .attr("height", barHeight)
        .attr("rx", 6)
        .style("fill", "rgba(255,255,255,0.08)");

      const bar = group
        .append("rect")
        .attr("x", margin.left)
        .attr("y", y)
        .attr("width", 0)
        .attr("height", barHeight)
        .attr("rx", 6)
        .style("fill", colors[sec.label])
        .style("filter", "drop-shadow(0 0 6px rgba(255,255,255,0.2))");

      bar
        .transition()
        .duration(1000)
        .ease(d3.easeCubicOut)
        .attr("width", barWidth * sec.progress);

      group
        .append("text")
        .attr("x", width - margin.right)
        .attr("y", y + 11)
        .attr("text-anchor", "end")
        .text(`${Math.round(sec.progress * 100)}%`)
        .style("fill", textColor)
        .style("font-size", "12px")
        .style("font-weight", "500");

      // Hover Glow and Tooltip
      group
        .on("mouseover", function (event) {
          d3.select(this)
            .select("rect:nth-child(2)")
            .transition()
            .duration(200)
            .style("filter", "drop-shadow(0 0 12px rgba(255,255,255,0.5))");
          
          const [mouseX, mouseY] = d3.pointer(event, document.body);
          tooltip
            .html(`<div class="tooltip-content">
              <div class="tooltip-description">${sec.description}</div>
              <div class="tooltip-count">${sec.completed}/${sec.total} completed</div>
            </div>`)
            .style("left", (mouseX + 10) + "px")
            .style("top", (mouseY - 10) + "px")
            .transition()
            .duration(200)
            .style("opacity", 1);
        })
        .on("mousemove", function (event) {
          const [mouseX, mouseY] = d3.pointer(event, document.body);
          tooltip
            .style("left", (mouseX + 10) + "px")
            .style("top", (mouseY - 10) + "px");
        })
        .on("mouseout", function () {
          d3.select(this)
            .select("rect:nth-child(2)")
            .transition()
            .duration(200)
            .style("filter", "drop-shadow(0 0 6px rgba(255,255,255,0.2))");
          
          tooltip
            .transition()
            .duration(200)
            .style("opacity", 0);
        });

      y += sectionSpacing;
    });

    // Set SVG dimensions to exactly match container
    svg.attr("width", width)
      .attr("height", height)
      .style("overflow", "hidden");

    // Cleanup function
    return () => {
      d3.select("body").select(".logistic-tooltip").remove();
    };
  }, [data]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (data && ref.current) {
        const container = ref.current.parentElement;
        if (container) {
          const svg = d3.select(ref.current);
          svg.selectAll("*").remove();

          const containerWidth = container.clientWidth || 400;
          const containerHeight = container.clientHeight || 400;
          const width = containerWidth;
          const height = containerHeight;
          const margin = { top: 15, left: 12, right: 12, bottom: 12 };
          const textColor = "#e2e8f0";

          const colors = {
            Education: "url(#gradEdu)",
            Medication: "url(#gradMed)",
            Caregiver: "url(#gradCare)",
            "Follow-ups": "url(#gradFollow)",
          };

          const sections = [
            {
              label: "Education",
              progress: data.education.topics.length
                ? data.education.completed / data.education.topics.length
                : 0,
              completed: data.education.completed,
              total: data.education.topics.length,
              description: "View education topics and completion status",
            },
            {
              label: "Medication",
              progress: data.medications.length
                ? data.medications.filter((m) => m.status === "completed").length /
                  data.medications.length
                : 0,
              completed: data.medications.filter((m) => m.status === "completed").length,
              total: data.medications.length,
              description: "View medication list and completion status",
            },
            {
              label: "Caregiver",
              progress:
                data.caregiver.status === "full"
                  ? 1
                  : data.caregiver.status === "partial"
                  ? 0.6
                  : 0.3,
              completed: data.caregiver.status === "full" ? 1 : data.caregiver.status === "partial" ? 1 : 0,
              total: 1,
              description: "View caregiver information and status",
            },
            {
              label: "Follow-ups",
              progress: data.followUps.length
                ? data.followUps.filter((f) => f.completed).length /
                  data.followUps.length
                : 0,
              completed: data.followUps.filter((f) => f.completed).length,
              total: data.followUps.length,
              description: "View follow-up tasks and completion status",
            },
          ];

          const defs = svg.append("defs");
          const gradients = [
            { id: "gradEdu", from: "#60a5fa", to: "#3b82f6" },
            { id: "gradMed", from: "#34d399", to: "#059669" },
            { id: "gradCare", from: "#f472b6", to: "#db2777" },
            { id: "gradFollow", from: "#facc15", to: "#eab308" },
          ];

          gradients.forEach((g) => {
            const grad = defs
              .append("linearGradient")
              .attr("id", g.id)
              .attr("x1", "0%")
              .attr("x2", "100%")
              .attr("y1", "0%")
              .attr("y2", "0%");
            grad.append("stop").attr("offset", "0%").attr("stop-color", g.from);
            grad.append("stop").attr("offset", "100%").attr("stop-color", g.to);
          });

          // Create or get tooltip element first
          let tooltip = d3.select("body").select(".logistic-tooltip");
          if (tooltip.empty()) {
            tooltip = d3.select("body")
              .append("div")
              .attr("class", "logistic-tooltip")
              .style("opacity", 0)
              .style("position", "absolute")
              .style("pointer-events", "none")
              .style("z-index", 10001);
          }

          // Calculate title height
          const titleHeight = 20; // Title text height
          const titleMargin = 12; // Space after title
          
          // --- Render Title ---
          let y = margin.top;
          svg
            .append("text")
            .attr("x", margin.left)
            .attr("y", y)
            .text("🧾 Patient Logistics & Education")
            .style("fill", "#fcfcfcff")
            .style("font-size", "15px")
            .style("font-weight", "700");

          y += titleHeight + titleMargin;

          // Calculate available height for sections
          const sectionAreaTop = y;
          const sectionAreaBottom = height - margin.bottom;
          const availableHeightForSections = sectionAreaBottom - sectionAreaTop;
          
          // Calculate spacing - each section needs space for label (6px) + gap (6px) + bar (14px) + spacing
          const sectionCount = sections.length;
          const minSectionHeight = 28; // Minimum: label(6) + gap(6) + bar(14) + spacing(2)
          const maxSectionHeight = 40;
          
          // Calculate optimal spacing to fill available height
          let sectionHeight = availableHeightForSections / sectionCount;
          sectionHeight = Math.max(minSectionHeight, Math.min(maxSectionHeight, sectionHeight));
          
          // Adjust spacing based on calculated section height
          const sectionSpacing = sectionHeight;

          sections.forEach((sec, i) => {
            const group = svg
              .append("g")
              .style("cursor", "pointer")
              .on("click", () => setShowModal(sec.label));

            group
              .append("text")
              .attr("x", margin.left)
              .attr("y", y)
              .text(sec.label)
              .style("fill", textColor)
              .style("font-size", "13px")
              .style("font-weight", "600");

            y += 6;

            const barWidth = width - margin.left - margin.right - 50;
            const barHeight = 14;

            group
              .append("rect")
              .attr("x", margin.left)
              .attr("y", y)
              .attr("width", barWidth)
              .attr("height", barHeight)
              .attr("rx", 6)
              .style("fill", "rgba(255,255,255,0.08)");

            const bar = group
              .append("rect")
              .attr("x", margin.left)
              .attr("y", y)
              .attr("width", 0)
              .attr("height", barHeight)
              .attr("rx", 6)
              .style("fill", colors[sec.label])
              .style("filter", "drop-shadow(0 0 6px rgba(255,255,255,0.2))");

            bar
              .transition()
              .duration(1000)
              .ease(d3.easeCubicOut)
              .attr("width", barWidth * sec.progress);

            group
              .append("text")
              .attr("x", width - margin.right)
              .attr("y", y + 11)
              .attr("text-anchor", "end")
              .text(`${Math.round(sec.progress * 100)}%`)
              .style("fill", textColor)
              .style("font-size", "12px")
              .style("font-weight", "500");

            // Hover Glow and Tooltip
            group
              .on("mouseover", function (event) {
                d3.select(this)
                  .select("rect:nth-child(2)")
                  .transition()
                  .duration(200)
                  .style("filter", "drop-shadow(0 0 12px rgba(255,255,255,0.5))");
                
                const [mouseX, mouseY] = d3.pointer(event, document.body);
                tooltip
                  .html(`<div class="tooltip-content">
                    <div class="tooltip-description">${sec.description}</div>
                    <div class="tooltip-count">${sec.completed}/${sec.total} completed</div>
                  </div>`)
                  .style("left", (mouseX + 10) + "px")
                  .style("top", (mouseY - 10) + "px")
                  .transition()
                  .duration(200)
                  .style("opacity", 1);
              })
              .on("mousemove", function (event) {
                const [mouseX, mouseY] = d3.pointer(event, document.body);
                tooltip
                  .style("left", (mouseX + 10) + "px")
                  .style("top", (mouseY - 10) + "px");
              })
              .on("mouseout", function () {
                d3.select(this)
                  .select("rect:nth-child(2)")
                  .transition()
                  .duration(200)
                  .style("filter", "drop-shadow(0 0 6px rgba(255,255,255,0.2))");
                
                tooltip
                  .transition()
                  .duration(200)
                  .style("opacity", 0);
              });

            y += sectionSpacing;
          });

          // Set SVG dimensions to exactly match container
          svg.attr("width", width)
            .attr("height", height)
            .style("overflow", "hidden");
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      d3.select("body").select(".logistic-tooltip").remove();
    };
  }, [data]);

  // --- Modal Details ---
  function getModalContent() {
    if (!data) return null;
    switch (showModal) {
      case "Education":
        return {
          title: "🎓 Education Topics",
          items: data.education.topics.map((e, i) => ({
            text: e,
            completed: i < data.education.completed,
          })),
        };
      case "Medication":
        return {
          title: "💊 Medication Details",
          items: data.medications.map((m) => ({
            text: m.name,
            completed: m.status === "completed",
          })),
        };
      case "Caregiver":
        return {
          title: "🧑‍🤝‍🧑 Caregiver Info",
          items: [
            {
              text: data.caregiver.text,
              completed: data.caregiver.status === "full",
            },
          ],
        };
      case "Follow-ups":
        return {
          title: "📋 Follow-up Tasks",
          items: data.followUps.map((f) => ({
            text: f.name,
            completed: f.completed,
          })),
        };
      default:
        return null;
    }
  }

  const modal = getModalContent();

  return (
    <>
      <div className="patient-logistic-container">
        <div className="logistic-svg-container">
          <svg ref={ref}></svg>
        </div>
      </div>

      {/* ✨ MODAL */}
      {modal && (
        <CommonModal
          isOpen={!!modal}
          onClose={() => setShowModal(null)}
          title={modal.title}
        >
          <ul className="common-modal-list">
            {modal.items.map((item, i) => (
              <li key={i} className="common-modal-list-item">
                <span
                  className={`common-modal-status-icon ${item.completed ? "common-modal-status-completed" : "common-modal-status-pending"}`}
                >
                  {item.completed ? "✅" : "⏳"}
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </CommonModal>
      )}
    </>
  );
}
