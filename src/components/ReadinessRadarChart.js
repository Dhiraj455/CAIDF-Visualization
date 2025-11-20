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

    const width = container.clientWidth || 600;
    const height = Math.min(container.clientHeight || 430, 420);
    const margin = { top: 90, right: 50, bottom: 80, left: 90 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 22)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "600")
      .attr("fill", "#f1f5f9")
      .text("Readiness Radar Chart");

    // Subtitle
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 38)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#94a3b8")
      .text("All domains (0-3 scale)");

    // Color scale for different time points
    const colors = {
      initial: "#ef4444", // Red
      final: "#10b981", // Green
      intermediate: "#3b82f6" // Blue
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
        .attr("stroke", i === levels.length - 1 ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.08)")
        .attr("stroke-width", i === levels.length - 1 ? 1.5 : 1)
        .attr("stroke-dasharray", i === levels.length - 1 ? "none" : "2,2");

      // Level labels
      if (level === 3) {
        g.append("text")
          .attr("x", 5)
          .attr("y", -rScale(level) + 4)
          .attr("text-anchor", "start")
          .attr("font-size", "9px")
          .attr("font-weight", "600")
          .attr("fill", "#60a5fa")
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
        .attr("stroke", "rgba(255, 255, 255, 0.15)")
        .attr("stroke-width", 1);

      // Domain labels
      const labelDistance = radius + 18;
      const labelX = Math.cos(angle) * labelDistance;
      const labelY = Math.sin(angle) * labelDistance;

      const labelText = g.append("text")
        .attr("x", labelX)
        .attr("y", labelY)
        .attr("text-anchor", labelX > 0 ? "start" : labelX < 0 ? "end" : "middle")
        .attr("alignment-baseline", labelY > 0 ? "text-before-edge" : "text-after-edge")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("fill", "#e2e8f0")
        .attr("cursor", "pointer")
        .text(domainLabels[domain] || domain);
      
      // Add hover to domain labels
      labelText
        .on("mouseover", function(event) {
          d3.select(this)
            .attr("fill", "#93c5fd")
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
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px")
            .transition()
            .duration(200)
            .style("opacity", 1);
        })
        .on("mouseout", function() {
          d3.select(this)
            .attr("fill", "#e2e8f0")
            .attr("font-weight", "600");
          
          tooltip
            .transition()
            .duration(200)
            .style("opacity", 0);
        });
    });

    // Function to draw radar polygon
    const drawRadarPolygon = (data, color, opacity = 0.7, strokeWidth = 2, label = "", date = "") => {
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
          
          tooltip
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
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px")
            .transition()
            .duration(200)
            .style("opacity", 1);
        })
        .on("mouseout", function() {
          d3.select(this)
            .attr("fill-opacity", opacity)
            .attr("stroke-width", strokeWidth);
          
          tooltip
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
            
            tooltip
              .html(`
                <div class="tooltip-header">${domainLabels[domain]}</div>
                <div class="tooltip-content">
                  <div class="tooltip-metric">Score: <strong>${value.toFixed(1)}</strong> / 3.0</div>
                  <div class="tooltip-desc">${getDomainDescription(domain)}</div>
                  ${label ? `<div class="tooltip-time">${label}${date ? ` (${date})` : ""}</div>` : ""}
                </div>
              `)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px")
              .transition()
              .duration(200)
              .style("opacity", 1);
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("r", 4)
              .attr("stroke-width", 2);
            
            tooltip
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
        drawRadarPolygon(progress, colors.intermediate, 0.6, 2.5, "Progress", progress.Date || "");
      }

      // Draw final (most visible)
      if (final) {
        drawRadarPolygon(final, colors.final, 0.7, 3, "Final", final.Date || "");
      }

      // Draw initial (most visible)
      if (initial) {
        drawRadarPolygon(initial, colors.initial, 0.7, 3, "Initial", initial.Date || "");
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
      drawRadarPolygon(radarData, color, 0.7, 3, label, radarData.Date || "");
    }

    // Legend
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width - 120}, ${height - 80})`);

    if (selectedTimePoint === "all") {
      const legendData = [
        { color: colors.initial, label: "Initial" },
        { color: colors.intermediate, label: "Progress" },
        { color: colors.final, label: "Final" }
      ];

      legendData.forEach((item, i) => {
        const lg = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
        lg.append("rect")
          .attr("width", 12)
          .attr("height", 12)
          .attr("rx", 2)
          .attr("fill", item.color)
          .attr("opacity", 0.8);
        lg.append("text")
          .attr("x", 18)
          .attr("y", 10)
          .attr("font-size", "10px")
          .attr("fill", "#e2e8f0")
          .text(item.label);
      });
    } else {
      const itemMap = {
        initial: { color: colors.initial, label: "Initial" },
        progress: { color: colors.intermediate, label: "Progress" },
        final: { color: colors.final, label: "Final" }
      };
      const item = itemMap[selectedTimePoint] || itemMap.final;
      const lg = legend.append("g");
      lg.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("rx", 2)
        .attr("fill", item.color)
        .attr("opacity", 0.8);
      lg.append("text")
        .attr("x", 18)
        .attr("y", 10)
        .attr("font-size", "10px")
        .attr("fill", "#e2e8f0")
        .text(item.label);
    }

    // Time point selector
    if (grid.length > 1) {
      const selectorY = height - 25;
      const selectorX = width / 2;
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
        // Center the buttons: 4 buttons, so i goes from 0-3, translate by (i - 1.5) * 60
        const optGroup = selector
          .append("g")
          .attr("transform", `translate(${(i - 1.7) * 60}, 0)`)
          .style("cursor", "pointer");

        const isSelected = selectedTimePoint === option.value;
        optGroup
          .append("rect")
          .attr("width", 50)
          .attr("height", 20)
          .attr("rx", 4)
          .attr("fill", isSelected ? "#3b82f6" : "rgba(255, 255, 255, 0.1)")
          .attr("stroke", isSelected ? "#60a5fa" : "rgba(255, 255, 255, 0.2)")
          .attr("stroke-width", 1);

        optGroup
          .append("text")
          .attr("x", 25)
          .attr("y", 13)
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("font-weight", isSelected ? "600" : "500")
          .attr("fill", isSelected ? "#fff" : "#94a3b8")
          .text(option.label);

        optGroup.on("click", () => {
          setSelectedTimePoint(option.value);
        });

        optGroup.on("mouseover", function () {
          if (!isSelected) {
            d3.select(this).select("rect").attr("fill", "rgba(255, 255, 255, 0.15)");
          }
        });

        optGroup.on("mouseout", function () {
          if (!isSelected) {
            d3.select(this).select("rect").attr("fill", "rgba(255, 255, 255, 0.1)");
          }
        });
      });
    }

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".radar-tooltip").remove();
    };

    svgRef.current = svg;
  }, [radarData, loading, selectedTimePoint, grid.length]);

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
          color: "#f1f5f9"
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
          color: "#f1f5f9"
        }}
      >
        No readiness data available
      </div>
    );
  }

  return <div ref={containerRef} className="readiness-radar-container"></div>;
}

