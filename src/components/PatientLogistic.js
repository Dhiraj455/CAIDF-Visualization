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


    const sections = [
      {
        label: "Education",
        progress: data.education.topics.length
          ? data.education.completed / data.education.topics.length
          : 0,
        completed: data.education.completed,
        total: data.education.topics.length,
        description: "View education topics and completion status",
        icon: "🎓",
        color: { from: "#60A5FA", to: "#2563EB" },
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
        icon: "💊",
        color: { from: "#A78BFA", to: "#8B5CF6" },
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
        icon: "🧑‍🤝‍🧑",
        color: { from: "#F472B6", to: "#EC4899" },
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
        icon: "📋",
        color: { from: "#FBBF24", to: "#F59E0B" },
      },
    ];

    // --- Gradient Definitions ---
    const defs = svg.append("defs");

    // Create gradients for each section
    sections.forEach((sec, i) => {
      const grad = defs
        .append("linearGradient")
        .attr("id", `grad${i}`)
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");
      grad.append("stop").attr("offset", "0%").attr("stop-color", sec.color.from);
      grad.append("stop").attr("offset", "100%").attr("stop-color", sec.color.to);
    });

    // Create tooltip element
    const tooltip = d3.select("body")
      .select(".logistic-tooltip")
      .node() ? d3.select("body").select(".logistic-tooltip") :
      d3.select("body")
        .append("div")
        .attr("class", "logistic-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", 10001)
        .style("background", "rgba(0,0,0,0.85)")
        .style("color", "#fff")
        .style("padding", "10px 14px")
        .style("border-radius", "6px")
        .style("font-size", "13px");

    // --- Render Title at top - centered and standardized ---
    const titleFontSize = containerWidth < 600 ? "14px" : 
                         containerWidth < 900 ? "16px" : "18px";
    const titleHeight = 25;
    const titleMargin = 8;
    
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", titleHeight)
      .attr("text-anchor", "middle")
      .attr("font-size", titleFontSize)
      .attr("font-weight", "600")
      .attr("fill", "#111827")
      .text("Patient Logistics & Education");

    // Calculate available space for rings (excluding title and labels)
    const topMargin = titleHeight + titleMargin + 10;
    const bottomMargin = 30; // Space for labels below rings
    const sideMargin = 55; // Side margins
    const availableWidth = width - (sideMargin * 2);
    const availableHeight = height - topMargin - bottomMargin;

    // Layout: 2x2 grid of circular progress rings
    // Calculate optimal ring size to fill container
    const gridCols = 2;
    const gridRows = 2;
    
    // Calculate spacing between rings (15% of available space)
    const horizontalGap = availableWidth * 0.12;
    const verticalGap = availableHeight * 0.12;
    
    // Calculate maximum ring diameter that fits
    const maxRingWidth = (availableWidth - horizontalGap) / gridCols;
    const maxRingHeight = (availableHeight - verticalGap) / gridRows;
    const maxRingDiameter = Math.min(maxRingWidth, maxRingHeight);
    
    // Ring radius should be about 45% of cell size to leave room for labels
    const ringRadius = Math.max(35, Math.min(60, maxRingDiameter * 0.45));
    const ringStrokeWidth = Math.max(8, Math.min(12, ringRadius * 0.15));
    
    // Calculate spacing between ring centers
    const horizontalSpacing = (availableWidth - (ringRadius * 2 * gridCols)) / (gridCols - 1) + (ringRadius * 2);
    const verticalSpacing = (availableHeight - (ringRadius * 2 * gridRows)) / (gridRows - 1) + (ringRadius * 2);
    
    // Calculate starting position to center the grid
    const totalGridWidth = (ringRadius * 2 * gridCols) + (horizontalSpacing - ringRadius * 2) * (gridCols - 1);
    const totalGridHeight = (ringRadius * 2 * gridRows) + (verticalSpacing - ringRadius * 2) * (gridRows - 1);
    const startX = sideMargin + (availableWidth - totalGridWidth) / 2 + ringRadius;
    const startY = topMargin + (availableHeight - totalGridHeight) / 2 + ringRadius;

    const positions = [
      { x: startX, y: startY }, // Top-left
      { x: startX + horizontalSpacing, y: startY }, // Top-right
      { x: startX, y: startY + verticalSpacing }, // Bottom-left
      { x: startX + horizontalSpacing, y: startY + verticalSpacing }, // Bottom-right
    ];
    
    // --- Render Circular Progress Rings ---
    sections.forEach((sec, i) => {
      const pos = positions[i];
      const group = svg
        .append("g")
        .attr("transform", `translate(${pos.x}, ${pos.y})`)
        .style("cursor", "pointer")
        .on("click", () => setShowModal(sec.label));

      // Background ring (gray)
      group
        .append("circle")
        .attr("r", ringRadius)
        .attr("fill", "none")
        .attr("stroke", "#E5E7EB")
        .attr("stroke-width", ringStrokeWidth);

      // Progress ring
      const circumference = 2 * Math.PI * ringRadius;
      const progressRing = group
        .append("circle")
        .attr("r", ringRadius)
        .attr("fill", "none")
        .attr("stroke", `url(#grad${i})`)
        .attr("stroke-width", ringStrokeWidth)
        .attr("stroke-linecap", "round")
        .attr("stroke-dasharray", circumference)
        .attr("stroke-dashoffset", circumference)
        .attr("transform", "rotate(-90)");

      // Animate progress
      progressRing
        .transition()
        .duration(1500)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", circumference * (1 - sec.progress));

      // Icon in center
      const iconSize = Math.max(20, Math.min(32, ringRadius * 1.2));
      group
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-6")
        .attr("font-size", `${iconSize}px`)
        .text(sec.icon);

      // Percentage text
      const percentFontSize = Math.max(12, Math.min(16, ringRadius * 0.7));
      group
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", `${percentFontSize + 2}`)
        .attr("font-size", `${percentFontSize}px`)
        .attr("font-weight", "700")
        .attr("fill", "#111827")
        .text(`${Math.round(sec.progress * 100)}%`);

      // Label below ring
      const labelFontSize = Math.max(10, Math.min(14, ringRadius * 0.5));
      const labelOffset = ringRadius + Math.max(20, ringRadius * 0.4);
      group
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", labelOffset)
        .attr("font-size", `${labelFontSize}px`)
        .attr("font-weight", "600")
        .attr("fill", "#6B7280")
        .text(sec.label);

      // Hover effects
      group
        .on("mouseover", function (event) {
          d3.select(this)
            .select("circle:last-child")
            .transition()
            .duration(200)
            .attr("stroke-width", ringStrokeWidth + 2)
            .attr("r", ringRadius + 2);

          const [mouseX, mouseY] = d3.pointer(event, document.body);
          tooltip
            .html(`
              <div style="font-weight:600;margin-bottom:4px;">${sec.icon} ${sec.label}</div>
              <div style="font-size:11px;opacity:0.9;">${sec.description}</div>
              <div style="margin-top:6px;font-size:12px;">
                <strong>${sec.completed}/${sec.total}</strong> completed
              </div>
            `)
            .style("left", (mouseX + 15) + "px")
            .style("top", (mouseY - 10) + "px")
            .transition()
            .duration(200)
            .style("opacity", 1);
        })
        .on("mousemove", function (event) {
          const [mouseX, mouseY] = d3.pointer(event, document.body);
          tooltip
            .style("left", (mouseX + 15) + "px")
            .style("top", (mouseY - 10) + "px");
        })
        .on("mouseout", function () {
          d3.select(this)
            .select("circle:last-child")
            .transition()
            .duration(200)
            .attr("stroke-width", ringStrokeWidth)
            .attr("r", ringRadius);

          tooltip
            .transition()
            .duration(200)
            .style("opacity", 0);
        });
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

          const sections = [
            {
              label: "Education",
              progress: data.education.topics.length
                ? data.education.completed / data.education.topics.length
                : 0,
              completed: data.education.completed,
              total: data.education.topics.length,
              description: "View education topics and completion status",
              icon: "🎓",
              color: { from: "#60A5FA", to: "#2563EB" },
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
              icon: "💊",
              color: { from: "#A78BFA", to: "#8B5CF6" },
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
              icon: "🧑‍🤝‍🧑",
              color: { from: "#F472B6", to: "#EC4899" },
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
              icon: "📋",
              color: { from: "#FBBF24", to: "#F59E0B" },
            },
          ];

          const defs = svg.append("defs");
          // Create gradients for each section
          sections.forEach((sec, i) => {
            const grad = defs
              .append("linearGradient")
              .attr("id", `grad${i}`)
              .attr("x1", "0%")
              .attr("x2", "100%")
              .attr("y1", "0%")
              .attr("y2", "0%");
            grad.append("stop").attr("offset", "0%").attr("stop-color", sec.color.from);
            grad.append("stop").attr("offset", "100%").attr("stop-color", sec.color.to);
          });

          // Create or get tooltip element
          let tooltip = d3.select("body").select(".logistic-tooltip");
          if (tooltip.empty()) {
            tooltip = d3.select("body")
              .append("div")
              .attr("class", "logistic-tooltip")
              .style("opacity", 0)
              .style("position", "absolute")
              .style("pointer-events", "none")
              .style("z-index", 10001)
              .style("background", "rgba(0,0,0,0.85)")
              .style("color", "#fff")
              .style("padding", "10px 14px")
              .style("border-radius", "6px")
              .style("font-size", "13px");
          }

          // --- Render Title at top - centered and standardized ---
          const titleFontSize = containerWidth < 600 ? "14px" : 
                               containerWidth < 900 ? "16px" : "18px";
          const titleHeight = 25;
          const titleMargin = 8;
          
          svg
            .append("text")
            .attr("x", width / 2)
            .attr("y", titleHeight)
            .attr("text-anchor", "middle")
            .attr("font-size", titleFontSize)
            .attr("font-weight", "600")
            .attr("fill", "#111827")
            .text("Patient Logistics & Education");

          // Calculate available space for rings (excluding title and labels)
          const topMargin = titleHeight + titleMargin;
          const bottomMargin = 35; // Space for labels below rings
          const sideMargin = 15; // Side margins
          const availableWidth = width - (sideMargin * 2);
          const availableHeight = height - topMargin - bottomMargin;

          // Layout: 2x2 grid of circular progress rings
          // Calculate optimal ring size to fill container
          const gridCols = 2;
          const gridRows = 2;
          
          // Calculate spacing between rings (15% of available space)
          const horizontalGap = availableWidth * 0.12;
          const verticalGap = availableHeight * 0.12;
          
          // Calculate maximum ring diameter that fits
          const maxRingWidth = (availableWidth - horizontalGap) / gridCols;
          const maxRingHeight = (availableHeight - verticalGap) / gridRows;
          const maxRingDiameter = Math.min(maxRingWidth, maxRingHeight);
          
          // Ring radius should be about 45% of cell size to leave room for labels
          const ringRadius = Math.max(35, Math.min(60, maxRingDiameter * 0.45));
          const ringStrokeWidth = Math.max(8, Math.min(12, ringRadius * 0.15));
          
          // Calculate spacing between ring centers
          const horizontalSpacing = (availableWidth - (ringRadius * 2 * gridCols)) / (gridCols - 1) + (ringRadius * 2);
          const verticalSpacing = (availableHeight - (ringRadius * 2 * gridRows)) / (gridRows - 1) + (ringRadius * 2);
          
          // Calculate starting position to center the grid
          const totalGridWidth = (ringRadius * 2 * gridCols) + (horizontalSpacing - ringRadius * 2) * (gridCols - 1);
          const totalGridHeight = (ringRadius * 2 * gridRows) + (verticalSpacing - ringRadius * 2) * (gridRows - 1);
          const startX = sideMargin + (availableWidth - totalGridWidth) / 2 + ringRadius;
          const startY = topMargin + (availableHeight - totalGridHeight) / 2 + ringRadius;

          const positions = [
            { x: startX, y: startY }, // Top-left
            { x: startX + horizontalSpacing, y: startY }, // Top-right
            { x: startX, y: startY + verticalSpacing }, // Bottom-left
            { x: startX + horizontalSpacing, y: startY + verticalSpacing }, // Bottom-right
          ];

          // --- Render Circular Progress Rings ---
          sections.forEach((sec, i) => {
            const pos = positions[i];
            const group = svg
              .append("g")
              .attr("transform", `translate(${pos.x}, ${pos.y})`)
              .style("cursor", "pointer")
              .on("click", () => setShowModal(sec.label));

            // Background ring (gray)
            group
              .append("circle")
              .attr("r", ringRadius)
              .attr("fill", "none")
              .attr("stroke", "#E5E7EB")
              .attr("stroke-width", ringStrokeWidth);

            // Progress ring
            const circumference = 2 * Math.PI * ringRadius;
            const progressRing = group
              .append("circle")
              .attr("r", ringRadius)
              .attr("fill", "none")
              .attr("stroke", `url(#grad${i})`)
              .attr("stroke-width", ringStrokeWidth)
              .attr("stroke-linecap", "round")
              .attr("stroke-dasharray", circumference)
              .attr("stroke-dashoffset", circumference)
              .attr("transform", "rotate(-90)");

            // Animate progress
            progressRing
              .transition()
              .duration(1500)
              .ease(d3.easeCubicOut)
              .attr("stroke-dashoffset", circumference * (1 - sec.progress));

            // Icon in center
            const iconSize = Math.max(20, Math.min(32, ringRadius * 1.2));
            group
              .append("text")
              .attr("text-anchor", "middle")
              .attr("dy", "-6")
              .attr("font-size", `${iconSize}px`)
              .text(sec.icon);

            // Percentage text
            const percentFontSize = Math.max(12, Math.min(16, ringRadius * 0.7));
            group
              .append("text")
              .attr("text-anchor", "middle")
              .attr("dy", `${percentFontSize + 2}`)
              .attr("font-size", `${percentFontSize}px`)
              .attr("font-weight", "700")
              .attr("fill", "#111827")
              .text(`${Math.round(sec.progress * 100)}%`);

            // Label below ring
            const labelFontSize = Math.max(10, Math.min(14, ringRadius * 0.5));
            const labelOffset = ringRadius + Math.max(20, ringRadius * 0.4);
            group
              .append("text")
              .attr("text-anchor", "middle")
              .attr("dy", labelOffset)
              .attr("font-size", `${labelFontSize}px`)
              .attr("font-weight", "600")
              .attr("fill", "#6B7280")
              .text(sec.label);

            // Hover effects
            group
              .on("mouseover", function (event) {
                d3.select(this)
                  .select("circle:last-child")
                  .transition()
                  .duration(200)
                  .attr("stroke-width", ringStrokeWidth + 2)
                  .attr("r", ringRadius + 2);

                const [mouseX, mouseY] = d3.pointer(event, document.body);
                tooltip
                  .html(`
                    <div style="font-weight:600;margin-bottom:4px;">${sec.icon} ${sec.label}</div>
                    <div style="font-size:11px;opacity:0.9;">${sec.description}</div>
                    <div style="margin-top:6px;font-size:12px;">
                      <strong>${sec.completed}/${sec.total}</strong> completed
                    </div>
                  `)
                  .style("left", (mouseX + 15) + "px")
                  .style("top", (mouseY - 10) + "px")
                  .transition()
                  .duration(200)
                  .style("opacity", 1);
              })
              .on("mousemove", function (event) {
                const [mouseX, mouseY] = d3.pointer(event, document.body);
                tooltip
                  .style("left", (mouseX + 15) + "px")
                  .style("top", (mouseY - 10) + "px");
              })
              .on("mouseout", function () {
                d3.select(this)
                  .select("circle:last-child")
                  .transition()
                  .duration(200)
                  .attr("stroke-width", ringStrokeWidth)
                  .attr("r", ringRadius);

                tooltip
                  .transition()
                  .duration(200)
                  .style("opacity", 0);
              });
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
