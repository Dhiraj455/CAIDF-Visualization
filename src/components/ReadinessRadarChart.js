import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { extractReadinessGrid } from "../utils/extractReadinessGrid";
import patient1Data from "../data/Patient1.txt";
import patient2Data from "../data/Patient2.txt";
import "./ReadinessRadarChart.css";

const domains = ["Mobility", "WoundCare", "MedicalStability", "Swallowing", "Education", "SocialSupport"];
const domainLabels = {
  Mobility: "Mobility",
  WoundCare: "Wound Care",
  MedicalStability: "Medical Stability",
  Swallowing: "Swallowing",
  Education: "Education",
  SocialSupport: "Social Support"
};

export default function ReadinessRadarChart({ patientNumber = 1 }) {
  const containerRef = useRef();
  const svgRef = useRef();
  const [grid, setGrid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimePoint, setSelectedTimePoint] = useState("all"); // "initial", "progress", "final", or "all"

  // Load patient data
  useEffect(() => {
    const patientFile = patientNumber === 1 ? patient1Data : patient2Data;
    setLoading(true);

    fetch(patientFile)
      .then((res) => res.text())
      .then((text) => {
        const extractedGrid = extractReadinessGrid(text);
        setGrid(extractedGrid);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading patient data for radar chart:", err);
        setLoading(false);
      });
  }, [patientNumber]);

  // Get data for selected time point
  const radarData = useMemo(() => {
    if (!grid || grid.length === 0) return null;

    if (selectedTimePoint === "initial") {
      return grid[0];
    } else if (selectedTimePoint === "progress") {
      // Get middle point (or closest to middle)
      const middleIndex = Math.floor(grid.length / 2);
      return grid[middleIndex] || grid[Math.max(0, middleIndex - 1)];
    } else if (selectedTimePoint === "final") {
      return grid[grid.length - 1];
    } else {
      // "all" - return all points
      return grid;
    }
  }, [grid, selectedTimePoint]);

  useEffect(() => {
    if (!containerRef.current || loading || !radarData) return;

    const container = containerRef.current;
    d3.select(container).selectAll("svg").remove();

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    // Increase left margin to accommodate time point selector buttons
    const margin = { top: 50, right: 30, bottom: 70, left: 100 };
    const availableWidth = width - margin.left - margin.right;
    const availableHeight = height - margin.top - margin.bottom;
    const radius = Math.min(availableWidth, availableHeight) / 2;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("overflow", "hidden");

    const g = svg
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Title - standardized format
    const titleFontSize = width < 600 ? "14px" : 
                         width < 900 ? "16px" : "18px";
    
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", titleFontSize)
      .attr("font-weight", "600")
      .attr("fill", "#111827")
      .text("Readiness Radar Chart");

    // Subtitle explaining date format in legend
    if (grid && grid.length > 0) {
      svg
        .append("text")
        .attr("x", width - 100)
        .attr("y", height - 75)
        .attr("text-anchor", "start")
        .attr("font-size", "8px")
        .attr("fill", "#9CA3AF")
        .attr("font-style", "italic")
        .text("Dates shown as M/D");
    }

    // Subtitle
    // svg
    //   .append("text")
    //   .attr("x", width / 2)
    //   .attr("y", 32)
    //   .attr("text-anchor", "middle")
    //   .attr("font-size", "9px")
    //   .attr("fill", "#94a3b8")
    //   .text("All domains (0-3 scale)");

    // Color scale for different time points - stronger colors
    const colors = {
      initial: "#EF4444", // Red
      final: "#10B981", // Green
      intermediate: "#0EA5E9" // Strong Blue
    };

    // Angle for each domain
    const angleSlice = (Math.PI * 2) / domains.length;

    // Scale for readiness (0-3 to radius)
    const rScale = d3.scaleLinear().domain([0, 3]).range([0, radius]);

    // Draw concentric circles (grid lines)
    const levels = [1, 2, 3];
    levels.forEach((level, i) => {
      g.append("circle")
        .attr("r", rScale(level))
        .attr("fill", "none")
        .attr("stroke", "#E5E7EB")
        .attr("stroke-width", i === levels.length - 1 ? 1.5 : 1)
        .attr("stroke-opacity", i === levels.length - 1 ? 1 : 0.5)
        .attr("stroke-dasharray", i === levels.length - 1 ? "none" : "2,2");

      // Level labels
      if (level === 3) {
        g.append("text")
          .attr("x", 5)
          .attr("y", -rScale(level) + 4)
          .attr("text-anchor", "start")
          .attr("font-size", "11px")
          .attr("font-weight", "700")
          .attr("fill", "#111827")
          .text(level);
      }
    });

    // Create tooltip
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "radar-tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("z-index", 10001);

    // Helper function for domain descriptions
    function getDomainDescription(domain) {
      const descriptions = {
        Mobility: "Patient's ability to move, transfer, and ambulate independently",
        WoundCare: "Status of wounds, healing progress, and infection control",
        MedicalStability: "Overall medical condition stability and vital signs",
        Swallowing: "Ability to swallow safely without aspiration risk",
        Education: "Patient and caregiver education on care management",
        SocialSupport: "Availability of caregivers and support systems"
      };
      return descriptions[domain] || "Readiness assessment domain";
    }

    // Draw axes (lines from center to edge)
    domains.forEach((domain, i) => {
      const angle = -Math.PI / 2 + angleSlice * i;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      // Axis line
      g.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", y)
        .attr("stroke", "#E5E7EB")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.6);

      // Domain labels
      const labelDistance = radius + 12;
      const labelX = Math.cos(angle) * labelDistance;
      const labelY = Math.sin(angle) * labelDistance;

      const labelText = g.append("text")
        .attr("x", labelX)
        .attr("y", labelY)
        .attr("text-anchor", labelX > 0 ? "start" : labelX < 0 ? "end" : "middle")
        .attr("alignment-baseline", labelY > 0 ? "text-before-edge" : "text-after-edge")
        .attr("font-size", "11px")
        .attr("font-weight", "700")
        .attr("fill", "#111827")
        .attr("cursor", "pointer")
        .text(domainLabels[domain] || domain);
      
      // Add hover to domain labels
      labelText
        .on("mouseover", function(event) {
          d3.select(this)
            .attr("fill", "#2563EB")
            .attr("font-weight", "700");
          
          // Get current data based on selected time point
          let currentData;
          if (Array.isArray(radarData)) {
            if (selectedTimePoint === "initial") {
              currentData = radarData[0];
            } else if (selectedTimePoint === "progress") {
              const middleIndex = Math.floor(radarData.length / 2);
              currentData = radarData[middleIndex] || radarData[Math.max(0, middleIndex - 1)];
            } else {
              currentData = radarData[radarData.length - 1];
            }
          } else {
            currentData = radarData;
          }
          const value = currentData ? (currentData[domain] || 0) : 0;
          
          tooltip
            .html(`
              <div class="tooltip-header">${domainLabels[domain]}</div>
              <div class="tooltip-content">
                <div class="tooltip-metric">Score: <strong>${value.toFixed(1)}</strong> / 3.0</div>
                <div class="tooltip-desc">${getDomainDescription(domain)}</div>
              </div>
            `)
            .style("left", (event.pageX + 30) + "px")
            .style("top", (event.pageY - 100) + "px")
            .transition()
            .duration(200)
            .style("opacity", 1);
        })
        .on("mouseout", function() {
          d3.select(this)
            .attr("fill", "#111827")
            .attr("font-weight", "700");
          
          tooltip
            .transition()
            .duration(200)
            .style("opacity", 0);
        });
    });

    // Function to draw radar polygon
    const drawRadarPolygon = (data, color, opacity = 0.7, strokeWidth = 2, label = "", date = "", tooltipRef = tooltip) => {
      // Build points array in the exact order of domains to match axis positions
      const points = [];
      for (let i = 0; i < domains.length; i++) {
        const domain = domains[i];
        const value = data[domain];
        points[i] = value !== undefined && value !== null ? value : 0;
      }

      const line = d3
        .lineRadial()
        .angle((d, i) => angleSlice * i)
        .radius((d) => rScale(d))
        .curve(d3.curveLinearClosed);

      // Draw filled area
      const path = g.append("path")
        .datum(points)
        .attr("d", line)
        .attr("fill", color)
        .attr("fill-opacity", opacity)
        .attr("stroke", color)
        .attr("stroke-width", strokeWidth)
        .attr("stroke-opacity", 0.9)
        .style("cursor", "pointer");

      // Add hover to polygon
      path
        .on("mouseover", function(event) {
          d3.select(this)
            .attr("fill-opacity", Math.min(1, opacity + 0.2))
            .attr("stroke-width", strokeWidth + 1);
          
          const avgScore = (points.reduce((a, b) => a + b, 0) / points.length).toFixed(2);
          const maxScore = Math.max(...points).toFixed(1);
          const minScore = Math.min(...points).toFixed(1);
          
          tooltipRef
            .html(`
              <div class="tooltip-header">${label || "Readiness Status"}${date ? ` - ${date}` : ""}</div>
              <div class="tooltip-content">
                <div class="tooltip-metric">Average: <strong>${avgScore}</strong> / 3.0</div>
                <div class="tooltip-metric">Range: ${minScore} - ${maxScore}</div>
                <div class="tooltip-scores">
                  ${domains.map((domain, i) => 
                    `<div>${domainLabels[domain]}: <strong>${points[i].toFixed(1)}</strong></div>`
                  ).join("")}
                </div>
              </div>
            `)
            .style("left", (event.pageX + 30) + "px")
            .style("top", (event.pageY - 100) + "px")
            .transition()
            .duration(200)
            .style("opacity", 1);
        })
        .on("mouseout", function() {
          d3.select(this)
            .attr("fill-opacity", opacity)
            .attr("stroke-width", strokeWidth);
          
          tooltipRef
            .transition()
            .duration(200)
            .style("opacity", 0);
        });

      // Draw data points with hover
      points.forEach((value, i) => {
        const angle = -Math.PI / 2 + angleSlice * i;
        const x = Math.cos(angle) * rScale(value);
        const y = Math.sin(angle) * rScale(value);
        const domain = domains[i];

        const pointCircle = g.append("circle")
          .attr("cx", x)
          .attr("cy", y)
          .attr("r", 4)
          .attr("fill", color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 2)
          .style("cursor", "pointer");

        // Add hover to points
        pointCircle
          .on("mouseover", function(event) {
            d3.select(this)
              .attr("r", 6)
              .attr("stroke-width", 3);
            
            tooltipRef
              .html(`
                <div class="tooltip-header">${domainLabels[domain]}</div>
                <div class="tooltip-content">
                  <div class="tooltip-metric">Score: <strong>${value.toFixed(1)}</strong> / 3.0</div>
                  <div class="tooltip-desc">${getDomainDescription(domain)}</div>
                  ${label ? `<div class="tooltip-time">${label}${date ? ` (${date})` : ""}</div>` : ""}
                </div>
              `)
              .style("left", (event.pageX + 30) + "px")
              .style("top", (event.pageY - 100) + "px")
              .transition()
              .duration(200)
              .style("opacity", 1);
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("r", 4)
              .attr("stroke-width", 2);
            
            tooltipRef
              .transition()
              .duration(200)
              .style("opacity", 0);
          });
      });
    };

    // Draw data based on selected time point
    if (selectedTimePoint === "all" && Array.isArray(radarData)) {
      // Show all time points with different colors/opacity
      const initial = radarData[0];
      const final = radarData[radarData.length - 1];
      const middleIndex = Math.floor(radarData.length / 2);
      const progress = radarData[middleIndex] || radarData[Math.max(0, middleIndex - 1)];

      // Draw intermediate points with lower opacity (progress points between middle and initial/final)
      if (radarData.length > 3) {
        // Points between initial and progress
        radarData.slice(1, middleIndex).forEach((point, i) => {
          const progressValue = i / Math.max(1, middleIndex - 1);
          const dateIndex = i + 1;
          drawRadarPolygon(
            point,
            colors.intermediate,
            0.1 + progressValue * 0.1,
            1,
            "Progress",
            point.Date || `Day ${dateIndex + 1}`
          );
        });
        
        // Points between progress and final
        radarData.slice(middleIndex + 1, -1).forEach((point, i) => {
          const progressValue = (i + 1) / Math.max(1, radarData.length - middleIndex - 2);
          const dateIndex = middleIndex + i + 1;
          drawRadarPolygon(
            point,
            colors.intermediate,
            0.15 + progressValue * 0.15,
            1,
            "Progress",
            point.Date || `Day ${dateIndex + 1}`
          );
        });
      }

      // Draw progress (middle point - more visible)
      if (progress) {
        drawRadarPolygon(progress, colors.intermediate, 0.20, 2, "Progress", progress.Date || "");
      }

      // Draw final (most visible)
      if (final) {
        drawRadarPolygon(final, colors.final, 0.20, 2, "Final", final.Date || "");
      }

      // Draw initial (most visible)
      if (initial) {
        drawRadarPolygon(initial, colors.initial, 0.20, 2, "Initial", initial.Date || "");
      }
    } else if (radarData && !Array.isArray(radarData)) {
      // Single time point
      let color, label;
      if (selectedTimePoint === "initial") {
        color = colors.initial;
        label = "Initial";
      } else if (selectedTimePoint === "progress") {
        color = colors.intermediate;
        label = "Progress";
      } else {
        color = colors.final;
        label = "Final";
      }
      drawRadarPolygon(radarData, color, 0.20, 2, label, radarData.Date || "");
    }

    // Legend with dates
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width - 100}, ${height - 60})`);

    // Extract dates from grid for legend
    let initialDate = "";
    let progressDate = "";
    let finalDate = "";
    
    if (grid && grid.length > 0) {
      initialDate = grid[0].Date || "";
      const middleIndex = Math.floor(grid.length / 2);
      progressDate = (grid[middleIndex] || grid[Math.max(0, middleIndex - 1)])?.Date || "";
      finalDate = grid[grid.length - 1].Date || "";
    }

    if (selectedTimePoint === "all") {
      const legendData = [
        { color: colors.initial, label: "Initial", date: initialDate },
        { color: colors.intermediate, label: "Progress", date: progressDate },
        { color: colors.final, label: "Final", date: finalDate }
      ];

      legendData.forEach((item, i) => {
        const lg = legend.append("g").attr("transform", `translate(0, ${i * 14})`);
        lg.append("rect")
          .attr("width", 10)
          .attr("height", 10)
          .attr("rx", 2)
          .attr("fill", item.color)
          .attr("opacity", 0.8);
        const labelText = item.date ? `${item.label} (${item.date})` : item.label;
        lg.append("text")
          .attr("x", 15)
          .attr("y", 8)
          .attr("font-size", "9px")
          .attr("fill", "#6B7280")
          .text(labelText);
      });
    } else {
      const itemMap = {
        initial: { color: colors.initial, label: "Initial", date: initialDate },
        progress: { color: colors.intermediate, label: "Progress", date: progressDate },
        final: { color: colors.final, label: "Final", date: finalDate }
      };
      const item = itemMap[selectedTimePoint] || itemMap.final;
      const lg = legend.append("g");
      lg.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("rx", 2)
        .attr("fill", item.color)
        .attr("opacity", 0.8);
      const labelText = item.date ? `${item.label} (${item.date})` : item.label;
      lg.append("text")
        .attr("x", 18)
        .attr("y", 10)
        .attr("font-size", "10px")
        .attr("fill", "#6B7280")
        .text(labelText);
    }

    // Time point selector - positioned on the left side, vertically centered
    if (grid.length > 1) {
      const selectorX = 15; // Left side position
      const selectorY = height / 2; // Vertically centered
      const selector = svg
        .append("g")
        .attr("transform", `translate(${selectorX}, ${selectorY})`);

      const options = [
        { value: "initial", label: "Initial" },
        { value: "progress", label: "Progress" },
        { value: "final", label: "Final" },
        { value: "all", label: "All" }
      ];

      options.forEach((option, i) => {
        // Stack buttons vertically: 4 buttons, translate by i * 30
        const optGroup = selector
          .append("g")
          .attr("transform", `translate(0, ${(i - 1.5) * 30})`)
          .style("cursor", "pointer");

        const isSelected = selectedTimePoint === option.value;
        optGroup
          .append("rect")
          .attr("width", 50)
          .attr("height", 22)
          .attr("rx", 4)
          .attr("fill", isSelected ? "#2563EB" : "#F3F4F6")
          .attr("stroke", isSelected ? "#2563EB" : "#E5E7EB")
          .attr("stroke-width", 1);

        optGroup
          .append("text")
          .attr("x", 25)
          .attr("y", 14)
          .attr("text-anchor", "middle")
          .attr("font-size", "9px")
          .attr("font-weight", isSelected ? "600" : "500")
          .attr("fill", isSelected ? "#fff" : "#6B7280")
          .text(option.label);

        optGroup.on("click", () => {
          setSelectedTimePoint(option.value);
        });

        optGroup.on("mouseover", function () {
          if (!isSelected) {
            d3.select(this).select("rect").attr("fill", "#E5E7EB");
          }
        });

        optGroup.on("mouseout", function () {
          if (!isSelected) {
            d3.select(this).select("rect").attr("fill", "#F3F4F6");
          }
        });
      });
    }

    svgRef.current = svg;

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".radar-tooltip").remove();
    };
  }, [radarData, loading, selectedTimePoint, grid]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current || loading || !radarData) return;

    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (containerRef.current && radarData && !loading) {
          // Trigger re-render by clearing and letting main effect redraw
          d3.select(containerRef.current).selectAll("svg").remove();
          // Force a small state update to trigger re-render
          const current = selectedTimePoint;
          setSelectedTimePoint(current === "initial" ? "final" : "initial");
          setTimeout(() => setSelectedTimePoint(current), 10);
        }
      }, 300);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
    };
  }, [radarData, loading, selectedTimePoint]);

  if (loading) {
    return (
      <div
        className="readiness-radar-loading"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
          color: "#6B7280"
        }}
      >
        Loading readiness data...
      </div>
    );
  }

  if (!grid || grid.length === 0) {
    return (
      <div
        className="readiness-radar-error"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
          color: "#6B7280"
        }}
      >
        No readiness data available
      </div>
    );
  }

  return <div ref={containerRef} className="readiness-radar-container"></div>;
}

