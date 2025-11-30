import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { extractRiskTrendData } from "../utils/extractRiskTrend";
import patient1Data from "../data/Patient1.txt";
import patient2Data from "../data/Patient2.txt";
import "./RiskTrendGraph.css";

function calculateRiskData(grid) {
  // Weight configuration
  const weights = {
    Mobility: 0.30,
    WoundCare: 0.25,
    MedicalStability: 0.30,
    Swallowing: 0.15
  };

  // Calculate daily risk score as weighted average
  // Grid values are already risk scores (3 = high risk, 0 = low risk)
  const risks = grid.map((day, index) => {
    const riskScore = 
      weights.Mobility * day.Mobility +
      weights.WoundCare * day.WoundCare +
      weights.MedicalStability * day.MedicalStability +
      weights.Swallowing * day.Swallowing;
    
    const deltaRisk = index > 0 
      ? (riskScore - (
          weights.Mobility * grid[index - 1].Mobility +
          weights.WoundCare * grid[index - 1].WoundCare +
          weights.MedicalStability * grid[index - 1].MedicalStability +
          weights.Swallowing * grid[index - 1].Swallowing
        ))
      : 0;
    
    return {
      date: day.Date,
      dayNumber: index + 1,
      riskScore: riskScore,
      deltaRisk: deltaRisk,
      components: {
        Mobility: day.Mobility,
        WoundCare: day.WoundCare,
        MedicalStability: day.MedicalStability,
        Swallowing: day.Swallowing
      }
    };
  });

  return risks;
}

export default function RiskTrendGraph({ patientNumber = 1 }) {
  const containerRef = useRef();
  const [grid, setGrid] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load patient data and extract risk trend
  useEffect(() => {
    const patientFile = patientNumber === 1 ? patient1Data : patient2Data;
    setLoading(true);

    fetch(patientFile)
      .then((res) => res.text())
      .then((text) => {
        const extractedGrid = extractRiskTrendData(text);
        setGrid(extractedGrid);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading patient data for risk trend:", err);
        setLoading(false);
      });
  }, [patientNumber]);

  const riskData = useMemo(() => {
    return grid.length > 0 ? calculateRiskData(grid) : [];
  }, [grid]);

  // Draw risk trend graph
  const drawRiskTrend = useCallback(() => {
    if (!containerRef.current || loading || grid.length === 0 || riskData.length === 0) return;

    const container = containerRef.current;
    d3.select(container).selectAll("svg").remove();

    const containerWidth = container.clientWidth || 800;
    const containerHeight = container.clientHeight || 500;
    
    // Responsive margins based on container size
    const getResponsiveMargins = () => {
      if (containerWidth < 600) {
        return { top: 50, right: 20, bottom: 70, left: 50 };
      } else if (containerWidth < 900) {
        return { top: 55, right: 30, bottom: 75, left: 55 };
      } else {
        return { top: 60, right: containerWidth > 1200 ? 120 : 100, bottom: 80, left: 60 };
      }
    };

    const margin = getResponsiveMargins();
    
    // Use full container dimensions
    const width = containerWidth;
    const height = containerHeight;

    const svg = d3.select(container)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("font-family", "sans-serif")
      .style("overflow", "hidden");

    // Title - standardized format (consistent with other bottom panel visualizations)
    const titleFontSize = containerWidth < 600 ? "14px" : 
                         containerWidth < 900 ? "16px" : "18px";
    
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", titleFontSize)
      .attr("font-weight", "600")
      .attr("fill", "#111827")
      .text("Patient Discharge Risk Trend");

    // Sub title - responsive font size
    const subtitleFontSize = containerWidth < 600 ? "10px" : "12px";
    
    // svg.append("text")
    //   .attr("x", width / 2)
    //   .attr("y", containerWidth < 600 ? 35 : 40)
    //   .attr("text-anchor", "middle")
    //   .attr("font-size", subtitleFontSize)
    //   .attr("fill", "#6B7280")
    //   .text("Lower scores indicate lower risk (direct mapping)");

    // Scales
    const x = d3.scaleLinear()
      .domain([1, riskData.length])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 3])
      .range([height - margin.bottom, margin.top]);

    // Color function for risk stages
    const getRiskColor = (score) => {
      if (score < 0.5) return "#22C55E"; // Low risk (0.0-0.5) - Green
      if (score < 1.5) return "#F59E0B"; // Medium risk (0.5-1.5) - Orange/Yellow
      return "#EF4444"; // High risk (1.5-3.0) - Red
    };

    // X axis
    const xAxis = svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(Math.min(riskData.length, containerWidth < 600 ? 5 : riskData.length)).tickFormat(d => {
        const dataPoint = riskData[d - 1];
        if (!dataPoint) return "";
        // Show abbreviated dates for small screens
        if (containerWidth < 600) {
          return dataPoint.date.split('/').slice(0, 2).join('/');
        }
        return dataPoint.date;
      }))
      .call(g => g.select(".domain").attr("stroke", "#E5E7EB"))
      .call(g => g.selectAll(".tick line").attr("stroke", "#E5E7EB"));

    xAxis.selectAll("text")
      .style("font-size", containerWidth < 600 ? "9px" : "11px")
      .attr("transform", containerWidth < 600 ? "rotate(-60)" : "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-6px")
      .attr("dy", "4px")
      .attr("fill", "#6B7280");

    // Y axis
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4))
      .call(g => g.select(".domain").attr("stroke", "#E5E7EB"))
      .call(g => g.selectAll(".tick line").attr("stroke", "#E5E7EB"))
      .selectAll("text")
      .style("font-size", containerWidth < 600 ? "10px" : "11px")
      .attr("fill", "#6B7280");

    // Y axis label
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", containerWidth < 600 ? "11px" : "13px")
      .attr("font-weight", "500")
      .attr("fill", "#6B7280")
      .text("Risk Score (0 = Low, 3 = High)");

    // Create line segments with colors based on risk levels
    const line = d3.line()
      .x(d => x(d.dayNumber))
      .y(d => y(d.riskScore))
      .curve(d3.curveMonotoneX);

    // Draw line segments with appropriate colors based on destination point's risk level
    // This creates a better visual where the line leading to a point matches that point's risk level
    for (let i = 0; i < riskData.length - 1; i++) {
      const segment = [riskData[i], riskData[i + 1]];
      // Use the destination point's risk level to determine segment color
      // This way, the line segment leading to a point is colored according to that point's risk level
      const segmentColor = getRiskColor(riskData[i + 1].riskScore);
      
      svg.append("path")
        .datum(segment)
        .attr("fill", "none")
        .attr("stroke", segmentColor)
        .attr("stroke-width", containerWidth < 600 ? 2.5 : 3)
        .attr("d", line);
    }

    // Tooltip
    const tooltip = d3.select("body")
      .select(".risk-trend-tooltip")
      .node() ? d3.select("body").select(".risk-trend-tooltip") :
      d3.select("body")
        .append("div")
        .attr("class", "risk-trend-tooltip")
      .style("position", "fixed")
      .style("pointer-events", "none")
      .style("background", "rgba(0,0,0,0.85)")
      .style("color", "#fff")
        .style("padding", "10px 14px")
      .style("border-radius", "6px")
        .style("font-size", "13px")
        .style("opacity", 0)
        .style("z-index", "1000");

    // Data points
    svg.selectAll(".dot")
      .data(riskData)
      .join("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.dayNumber))
      .attr("cy", d => y(d.riskScore))
      .attr("r", containerWidth < 600 ? 3 : 4)
      .attr("fill", d => getRiskColor(d.riskScore))
      .attr("stroke", "#fff")
      .attr("stroke-width", containerWidth < 600 ? 1.5 : 2)
      .style("cursor", "pointer")
      .on("pointerenter", function (event, d) {
        d3.select(this).attr("r", containerWidth < 600 ? 5 : 6);
        const riskLevel = d.riskScore < 0.5 ? "Low Risk"
          : d.riskScore < 1.5 ? "Medium Risk"
            : "High Risk";
        const deltaText = d.deltaRisk > 0 ? `+${d.deltaRisk.toFixed(2)}` : d.deltaRisk.toFixed(2);
        const deltaColor = d.deltaRisk > 0 ? "#f44336" : d.deltaRisk < 0 ? "#4caf50" : "#999";
        tooltip.style("opacity", 1)
          .html(`
          <div style="font-weight:600;margin-bottom:6px;font-size:14px;">${d.date} (Day ${d.dayNumber})</div>
          <div style="margin-bottom:4px;">
            <span style="color:${getRiskColor(d.riskScore)};">●</span>
            <strong>Risk Score:</strong> ${d.riskScore.toFixed(2)} (${riskLevel})
          </div>
          ${d.dayNumber > 1 ? `<div style="color:${deltaColor};margin-bottom:6px;">
            <strong>Change:</strong> ${deltaText}
          </div>` : ""}
          <div style="border-top:1px solid rgba(255,255,255,0.3);padding-top:6px;margin-top:6px;font-size:11px;">
            <div>Mobility: ${d.components.Mobility}</div>
            <div>Wound Care: ${d.components.WoundCare}</div>
            <div>Medical Stability: ${d.components.MedicalStability}</div>
            <div>Swallowing: ${d.components.Swallowing}</div>
          </div>
        `)
          .style("left", (event.clientX + 15) + "px")
          .style("top", (event.clientY - 80) + "px");
      })
      .on("pointermove", e => tooltip.style("left", (e.clientX + 15) + "px").style("top", (e.clientY - 80) + "px"))
      .on("pointerleave", function () {
        d3.select(this).attr("r", containerWidth < 600 ? 3 : 4);
        tooltip.style("opacity", 0);
      });

    // Legend - responsive positioning
    const legendX = width - margin.right - (containerWidth < 600 ? 80 : containerWidth < 900 ? 100 : 120);
    const legendY = margin.top;
    
    const legend = svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY})`);

      const legendData = [
      { label: "Low Risk", color: "#22C55E", score: "0.0–0.5" },
      { label: "Medium Risk", color: "#F59E0B", score: "0.5–1.5" },
      { label: "High Risk", color: "#EF4444", score: "1.5–3.0" }
    ];

    const legendFontSize = containerWidth < 600 ? "9px" : "11px";
    const legendSmallFontSize = containerWidth < 600 ? "7px" : "9px";

        legendData.forEach((item, i) => {
      const lg = legend.append("g").attr("transform", `translate(0, ${i * (containerWidth < 600 ? 20 : 25)})`);
      lg.append("circle")
        .attr("r", containerWidth < 600 ? 4 : 5)
            .attr("fill", item.color)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);
          lg.append("text")
        .attr("x", containerWidth < 600 ? 10 : 12)
        .attr("y", containerWidth < 600 ? 3 : 4)
        .attr("font-size", legendFontSize)
        .attr("fill", "#111827")
            .text(item.label);
      lg.append("text")
        .attr("x", containerWidth < 600 ? 10 : 12)
        .attr("y", containerWidth < 600 ? 13 : 16)
        .attr("font-size", legendSmallFontSize)
        .attr("fill", "#6B7280")
        .text(`(${item.score})`);
    });

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".risk-trend-tooltip").remove();
    };
  }, [riskData, loading, grid.length]);

  useEffect(() => {
    drawRiskTrend();
  }, [drawRiskTrend]);

  // Handle window resize
  useEffect(() => {
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        drawRiskTrend();
      }, 150);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
    };
  }, [drawRiskTrend]);

  if (loading) {
    return (
      <div
        className="risk-trend-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#9CA3AF',
          fontSize: '14px'
        }}
      >
        Loading risk trend data...
      </div>
    );
  }

  if (grid.length === 0) {
    return (
      <div
        className="risk-trend-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#9CA3AF',
          fontSize: '14px'
        }}
      >
        No risk trend data available
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="risk-trend-container"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
