import React, { useEffect, useRef, useState, useMemo } from "react";
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

  useEffect(() => {
    if (!containerRef.current || loading || grid.length === 0 || riskData.length === 0) return;

    const container = containerRef.current;
    d3.select(container).selectAll("svg").remove();

    const containerWidth = container.clientWidth || 800;
    const containerHeight = container.clientHeight || 500;
    
    // Adjust margins based on container size - ensure legend space
    const margin = { 
      top: 60, 
      right: containerWidth > 700 ? 120 : 100, 
      bottom: 80, 
      left: 60 
    };
    
    // Calculate width and height to fit within container
    const width = Math.max(containerWidth - 20, 500);
    const height = Math.max(Math.min(containerHeight - 20, containerHeight - 20), 300);

    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("font-family", "sans-serif")
      .style("overflow", "hidden");

    // Title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("font-weight", "600")
      .attr("fill", "#f1f5f9")
      .text("Patient Discharge Risk Trend");

    // Sub title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 45)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#94a3b8")
      .text("Lower scores indicate lower risk (direct mapping)");

    // Scales
    const x = d3.scaleLinear()
      .domain([1, riskData.length])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 3])
      .range([height - margin.bottom, margin.top]);

    // Color scale - low-green high-red
    const colorScale = d3.scaleLinear()
      .domain([0, 1.5, 3])
      .range(["#1a9850", "#fee08b", "#d73027"]);

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(riskData.length).tickFormat(d => riskData[d - 1]?.date ?? ""))
      .call(g => g.select(".domain").attr("stroke", "#64748b"))
      .selectAll("text")
      .style("font-size", "11px")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-8px")
      .attr("dy", "2px")
      .attr("fill", "#e2e8f0");

    // Y axis
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4))
      .call(g => g.select(".domain").attr("stroke", "#64748b"))
      .selectAll("text")
      .attr("fill", "#e2e8f0");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("font-weight", "500")
      .attr("fill", "#e2e8f0")
      .text("Risk Score (0 = Low, 3 = High)");

    // Gradient color for line
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "line-gradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right);

    riskData.forEach((d, i) => {
      gradient.append("stop")
        .attr("offset", `${(i / (riskData.length - 1)) * 100}%`)
        .attr("stop-color", colorScale(d.riskScore));
    });

    // Curve line
    const line = d3.line()
      .x(d => x(d.dayNumber))
      .y(d => y(d.riskScore))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(riskData)
      .attr("fill", "none")
      .attr("stroke", "url(#line-gradient)")
      .attr("stroke-width", 3)
      .attr("d", line);

    // Tooltip
    const tooltip = d3.select(document.body)
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
      .attr("r", 5)
      .attr("fill", d => colorScale(d.riskScore))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("pointerenter", function (event, d) {
        d3.select(this).attr("r", 8);
        const riskLevel = d.riskScore < 0.5 ? "Low Risk"
          : d.riskScore < 1.5 ? "Medium Risk"
            : "High Risk";
        const deltaText = d.deltaRisk > 0 ? `+${d.deltaRisk.toFixed(2)}` : d.deltaRisk.toFixed(2);
        const deltaColor = d.deltaRisk > 0 ? "#f44336" : d.deltaRisk < 0 ? "#4caf50" : "#999";
        tooltip.style("opacity", 1)
          .html(`
          <div style="font-weight:600;margin-bottom:6px;font-size:14px;">${d.date} (Day ${d.dayNumber})</div>
          <div style="margin-bottom:4px;">
            <span style="color:${colorScale(d.riskScore)};">●</span>
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
          .style("top", (event.clientY - 10) + "px");
      })
      .on("pointermove", e => tooltip.style("left", (e.clientX + 15) + "px").style("top", (e.clientY - 10) + "px"))
      .on("pointerleave", function () {
        d3.select(this).attr("r", 5);
        tooltip.style("opacity", 0);
      });

    // Legend - always show
    const legend = svg.append("g")
      .attr("transform", `translate(${width - margin.right + 10}, ${margin.top})`);

    const legendData = [
      { label: "Low Risk", color: "#1a9850", score: "0.0–0.5" },
      { label: "Medium Risk", color: "#fee08b", score: "0.5–1.5" },
      { label: "High Risk", color: "#d73027", score: "1.5–3.0" }
    ];

    legendData.forEach((item, i) => {
      const lg = legend.append("g").attr("transform", `translate(0, ${i * 25})`);
      lg.append("circle").attr("r", 5).attr("fill", item.color).attr("stroke", "#fff").attr("stroke-width", 1);
      lg.append("text").attr("x", 12).attr("y", 4).attr("font-size", "11px").attr("fill", "#e2e8f0").text(item.label);
      lg.append("text").attr("x", 12).attr("y", 16).attr("font-size", "9px").attr("fill", "#94a3b8").text(`(${item.score})`);
    });

    // Cleanup function
    return () => {
      d3.select(document.body).selectAll(".risk-trend-tooltip").remove();
    };
  }, [riskData, loading, grid.length]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        d3.select(container).selectAll("svg").remove();
        
        const containerWidth = container.clientWidth || 800;
        const containerHeight = container.clientHeight || 500;
        
        // Adjust margins based on container size - ensure legend space
        const margin = { 
          top: 60, 
          right: containerWidth > 700 ? 120 : 100, 
          bottom: 60, 
          left: 60 
        };
        
        // Calculate width and height to fit within container
        const width = Math.max(containerWidth - 20, 500);
        const height = Math.max(Math.min(containerHeight - 20, containerHeight - 20), 350);

        const svg = d3.select(container)
          .append("svg")
          .attr("width", width)
          .attr("height", height)
          .attr("viewBox", `0 0 ${width} ${height}`)
          .attr("preserveAspectRatio", "xMidYMid meet")
          .style("font-family", "sans-serif")
          .style("overflow", "hidden");

        svg.append("text")
          .attr("x", width / 2)
          .attr("y", 25)
          .attr("text-anchor", "middle")
          .attr("font-size", "18px")
          .attr("font-weight", "600")
          .attr("fill", "#f1f5f9")
          .text("Patient Discharge Risk Trend");

        svg.append("text")
          .attr("x", width / 2)
          .attr("y", 45)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("fill", "#94a3b8")
          .text("Lower scores indicate lower risk (direct mapping)");

        const x = d3.scaleLinear()
          .domain([1, riskData.length])
          .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
          .domain([0, 3])
          .range([height - margin.bottom, margin.top]);

        const colorScale = d3.scaleLinear()
          .domain([0, 1.5, 3])
          .range(["#1a9850", "#fee08b", "#d73027"]);

        svg.append("g")
          .attr("transform", `translate(0,${height - margin.bottom})`)
          .call(d3.axisBottom(x).ticks(riskData.length).tickFormat(d => riskData[d - 1]?.date ?? ""))
          .call(g => g.select(".domain").attr("stroke", "#64748b"))
          .selectAll("text")
          .style("font-size", "11px")
          .attr("transform", "rotate(-45)")
          .style("text-anchor", "end")
          .attr("dx", "-8px")
          .attr("dy", "2px")
          .attr("fill", "#e2e8f0");

        svg.append("g")
          .attr("transform", `translate(${margin.left},0)`)
          .call(d3.axisLeft(y).ticks(4))
          .call(g => g.select(".domain").attr("stroke", "#64748b"))
          .selectAll("text")
          .attr("fill", "#e2e8f0");

        svg.append("text")
          .attr("transform", "rotate(-90)")
          .attr("x", -(height / 2))
          .attr("y", 15)
          .attr("text-anchor", "middle")
          .attr("font-size", "13px")
          .attr("font-weight", "500")
          .attr("fill", "#e2e8f0")
          .text("Risk Score (0 = Low, 3 = High)");

        const gradient = svg.append("defs")
          .append("linearGradient")
          .attr("id", "line-gradient-resize")
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", margin.left)
          .attr("x2", width - margin.right);

        riskData.forEach((d, i) => {
          gradient.append("stop")
            .attr("offset", `${(i / (riskData.length - 1)) * 100}%`)
            .attr("stop-color", colorScale(d.riskScore));
        });

        const line = d3.line()
          .x(d => x(d.dayNumber))
          .y(d => y(d.riskScore))
          .curve(d3.curveMonotoneX);

        svg.append("path")
          .datum(riskData)
          .attr("fill", "none")
          .attr("stroke", "url(#line-gradient-resize)")
          .attr("stroke-width", 3)
          .attr("d", line);

        const tooltip = d3.select(document.body)
          .select(".risk-trend-tooltip")
          .node() ? d3.select(document.body).select(".risk-trend-tooltip") :
          d3.select(document.body)
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

        svg.selectAll(".dot")
          .data(riskData)
          .join("circle")
          .attr("class", "dot")
          .attr("cx", d => x(d.dayNumber))
          .attr("cy", d => y(d.riskScore))
          .attr("r", 5)
          .attr("fill", d => colorScale(d.riskScore))
          .attr("stroke", "#fff")
          .attr("stroke-width", 2)
          .style("cursor", "pointer")
          .on("pointerenter", function (event, d) {
            d3.select(this).attr("r", 8);
            const riskLevel = d.riskScore < 0.5 ? "Low Risk"
              : d.riskScore < 1.5 ? "Medium Risk"
                : "High Risk";
            const deltaText = d.deltaRisk > 0 ? `+${d.deltaRisk.toFixed(2)}` : d.deltaRisk.toFixed(2);
            const deltaColor = d.deltaRisk > 0 ? "#f44336" : d.deltaRisk < 0 ? "#4caf50" : "#999";
            tooltip.style("opacity", 1)
              .html(`
              <div style="font-weight:600;margin-bottom:6px;font-size:14px;">${d.date} (Day ${d.dayNumber})</div>
              <div style="margin-bottom:4px;">
                <span style="color:${colorScale(d.riskScore)};">●</span>
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
              .style("top", (event.clientY - 10) + "px");
          })
          .on("pointermove", e => tooltip.style("left", (e.clientX + 15) + "px").style("top", (e.clientY - 10) + "px"))
          .on("pointerleave", function () {
            d3.select(this).attr("r", 5);
            tooltip.style("opacity", 0);
          });

        // Legend - always show
        const legend = svg.append("g")
          .attr("transform", `translate(${width - margin.right + 10}, ${margin.top})`);

        const legendData = [
          { label: "Low Risk", color: "#1a9850", score: "0.0–0.5" },
          { label: "Medium Risk", color: "#fee08b", score: "0.5–1.5" },
          { label: "High Risk", color: "#d73027", score: "1.5–3.0" }
        ];

        legendData.forEach((item, i) => {
          const lg = legend.append("g").attr("transform", `translate(0, ${i * 25})`);
          lg.append("circle").attr("r", 5).attr("fill", item.color).attr("stroke", "#fff").attr("stroke-width", 1);
          lg.append("text").attr("x", 12).attr("y", 4).attr("font-size", "11px").attr("fill", "#e2e8f0").text(item.label);
          lg.append("text").attr("x", 12).attr("y", 16).attr("font-size", "9px").attr("fill", "#94a3b8").text(`(${item.score})`);
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [riskData, loading, grid.length]);

  if (loading) {
    return (
      <div className="risk-trend-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: '#f1f5f9' }}>
        Loading risk trend data...
      </div>
    );
  }

  if (grid.length === 0) {
    return (
      <div className="risk-trend-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: '#f1f5f9' }}>
        No risk trend data available
      </div>
    );
  }

  return (
    <div ref={containerRef} className="risk-trend-container"></div>
  );
}

