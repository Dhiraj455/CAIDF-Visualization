import React, { useEffect, useRef, useCallback, useState } from "react";
import * as d3 from "d3";
import { usePatientData } from "../utils/usePatientData";
import CommonModal from "./CommonModal";
import "./PatientTimeLine.css";

export default function PatientTimeLine({ patientNumber = 1 }) {
  const { phases, sections, events, eventsWithMeds, loading } = usePatientData(patientNumber);
  const containerRef = useRef();
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Compute phase centers based on section counts (proportional spacing)
  function computePhaseCenters(phases, sections, availableHeight) {
    const PHASES = ["home", "er", "unit", "discharge", "back_home"];
    const centers = {};
    let currentPos = 0;
    
    // Get phase order from phases array
    const phaseOrderMap = {};
    if (phases && Array.isArray(phases)) {
      phases.forEach(p => {
        if (PHASES.includes(p.key)) {
          phaseOrderMap[p.key] = p.order;
        }
      });
    }
    
    // Calculate positions based on section counts, sorted by phase order
    const phaseData = PHASES.map(phaseKey => {
      const phaseSections = sections.filter(s => s.phase === phaseKey);
      const count = phaseSections.length;
      const order = phaseOrderMap[phaseKey] !== undefined ? phaseOrderMap[phaseKey] : 999;
      return { phaseKey, count, order };
    }).sort((a, b) => a.order - b.order);
    
    // Filter out phases with no sections
    const phasesWithSections = phaseData.filter(p => p.count > 0);
    
    if (phasesWithSections.length === 0) {
      return { centers: {}, total: availableHeight };
    }
    
    // Calculate total count for proportional sizing
    const totalCount = phasesWithSections.reduce((sum, p) => sum + Math.max(p.count, 1), 0);
    
    // Use available height instead of fixed baseHeight
    const baseHeight = availableHeight || 1000;
    
    // Calculate phase heights proportionally
    phasesWithSections.forEach(({ phaseKey, count }) => {
      const phaseHeight = (Math.max(count, 1) / totalCount) * baseHeight;
      centers[phaseKey] = currentPos + phaseHeight / 2;
      currentPos += phaseHeight;
    });
    
    return { centers, total: currentPos || baseHeight };
  }

  // ---------- draw chart ----------
  const drawChart = useCallback((chartDiv, onPhaseClick) => {
    if (!chartDiv) return;
    chartDiv.innerHTML = "";
    if (!events || !events.length || !sections || !phases) return;

    const PHASES = ["home", "er", "unit", "discharge", "back_home"];
    const vBase = Object.fromEntries(PHASES.map((k) => [k, 0]));
    const vMeds = Object.fromEntries(PHASES.map((k) => [k, 0]));

    events.forEach((d) => {
      if (d && vBase.hasOwnProperty(d.phase)) vBase[d.phase] = Math.max(0, d.value || 0);
    });
    (eventsWithMeds || events).forEach((d) => {
      if (d && vMeds.hasOwnProperty(d.phase)) vMeds[d.phase] = Math.max(0, d.value || 0);
    });

    // Define margin first
    const margin = { top: 16, right: 24, bottom: 28, left: 88 };
    
    // Use the visible container height for the chart
    const containerHeight = chartDiv.clientHeight || chartDiv.offsetHeight || 500;
    const availableHeight = containerHeight - margin.top - margin.bottom;
    const innerH = Math.max(availableHeight, 300);
    
    // Calculate phase centers with the actual available height
    const { centers, total: contentTotal } = computePhaseCenters(phases, sections, innerH);
    
    if (!contentTotal || Object.keys(centers).length === 0) {
      return;
    }

    function phaseBounds(centers, totalHeight) {
      const keys = PHASES.filter((k) => centers[k] != null).sort((a, b) => centers[a] - centers[b]);
      if (keys.length === 0) return {};
      
      const b = {};
      
      // Calculate boundaries between phases
      keys.forEach((k, i) => {
        const centerY = centers[k];
        
        // For first phase, start at 0
        if (i === 0) {
          b[k] = [0, i === keys.length - 1 ? totalHeight : (centers[keys[i + 1]] + centerY) / 2];
        } else if (i === keys.length - 1) {
          // For last phase, end at totalHeight
          b[k] = [(centers[keys[i - 1]] + centerY) / 2, totalHeight];
        } else {
          // For middle phases, use midpoints
          b[k] = [(centers[keys[i - 1]] + centerY) / 2, (centers[keys[i + 1]] + centerY) / 2];
        }
      });
      
      return b;
    }
    
    const bounds = phaseBounds(centers, innerH);
    const phaseOrder = PHASES.filter((k) => bounds[k] && bounds[k].length === 2);

    function buildStepSeries(values) {
      const s = [];
      for (const k of phaseOrder) {
        if (!bounds[k] || bounds[k].length !== 2) continue;
        const [y0, y1] = bounds[k];
        const v = values[k] || 0;
        s.push({ t: Math.max(0, y0 + 1e-3), d: v });
        s.push({ t: Math.min(innerH, y1 - 1e-3), d: v });
      }
      return s;
    }

    // Build step series now that bounds are calculated
    const baseSeries = buildStepSeries(vBase);
    const medsSeries = buildStepSeries(vMeds);

    // Get the actual container width (which is 65% of screen minus padding)
    const chartWidth = chartDiv.clientWidth || chartDiv.offsetWidth || 640;
    // Use the container width directly, with a reasonable minimum
    const w = Math.max(chartWidth, 400);
    const innerW = Math.max(w - margin.left - margin.right, 100);

    const totalHeight = innerH + margin.top + margin.bottom;

    const svg = d3
      .select(chartDiv)
      .append("svg")
      .attr("width", w)
      .attr("height", totalHeight)
      .attr("viewBox", `0 0 ${w} ${totalHeight}`)
      .attr("preserveAspectRatio", "xMinYMin meet");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scaleLinear().domain([0, innerH]).range([0, innerH]);
    const x = d3
      .scaleLinear()
      .domain([0, d3.max([d3.max(baseSeries, (d) => d.d) || 0, d3.max(medsSeries, (d) => d.d) || 0])])
      .nice()
      .range([0, innerW]);

    const area = d3.area().x0(0).x1((d) => x(d.d)).y((d) => y(d.t)).curve(d3.curveMonotoneY);
    const line = d3.line().x((d) => x(d.d)).y((d) => y(d.t)).curve(d3.curveMonotoneY);

    // ---------- baseline & meds trend ----------
    g.append("path").datum(baseSeries).attr("fill", "#c6dbef").attr("stroke", "#084594").attr("stroke-width", 1.4).attr("d", area);

    (function drawDiffFill() {
      const interp = (series, t) => {
        if (!series.length) return 0;
        let lo = 0,
          hi = series.length - 1;
        while (hi - lo > 1) {
          const m = (lo + hi) >> 1;
          series[m].t < t ? (lo = m) : (hi = m);
        }
        const a = series[lo],
          b = series[hi] || a,
          u = (t - a.t) / Math.max(1e-6, b.t - a.t);
        return (1 - u) * a.d + u * b.d;
      };
      const GRID_N = 300;
      const gridT = d3.range(GRID_N).map((i) => innerH * (i / (GRID_N - 1)));
      const segments = [];
      let run = [];
      for (const t of gridT) {
        const blue = interp(baseSeries, t);
        const red = interp(medsSeries, t);
        if (red > blue + 1e-9) run.push({ t, blue, red });
        else if (run.length) {
          segments.push(run);
          run = [];
        }
      }
      if (run.length) segments.push(run);

      segments.forEach((seg) => {
        const top = seg.map((p) => ({ t: p.t, d: p.red }));
        const bot = seg.slice().reverse().map((p) => ({ t: p.t, d: p.blue }));
        g.append("path").datum([...top, ...bot]).attr("fill", "#f8bcbc").attr("stroke", "none").attr("d", area);
      });
    })();

    g.append("path").datum(medsSeries).attr("fill", "none").attr("stroke", "#d62728").attr("stroke-width", 1.8).attr("d", line);

    // ---------- completeness stacked bars ----------
    const completeness = [
      { from: "home", to: "er", present: 4, missing: 2, partial: 0 },
      { from: "er", to: "unit", present: 5, missing: 2, partial: 1 },
      { from: "unit", to: "discharge", present: 0, missing: 0, partial: 0 },
      { from: "discharge", to: "back_home", present: 7, missing: 0, partial: 1 }
    ];

    const BAR_W = Math.min(140, innerW * 0.32);
    const BAR_H = 12;
    const PAD = 8;

    completeness.forEach((row) => {
      if (!bounds[row.to] || !bounds[row.from]) return;
      const ySeam = bounds[row.to][0];
      const yPix = y(ySeam) - BAR_H / 2;

      const totalItems = (row.present || 0) + (row.missing || 0) + (row.partial || 0);
      if (totalItems <= 0) return;

      const frac = {
        present: (row.present || 0) / totalItems,
        partial: (row.partial || 0) / totalItems,
        missing: (row.missing || 0) / totalItems
      };

      const x0 = innerW - BAR_W - PAD;
      const segW = (k) => BAR_W * frac[k];

      g.append("rect").attr("x", x0).attr("y", yPix).attr("width", segW("present")).attr("height", BAR_H).attr("fill", "#34d399");
      g.append("rect").attr("x", x0 + segW("present")).attr("y", yPix).attr("width", segW("partial")).attr("height", BAR_H).attr("fill", "#f59e0b");
      g.append("rect").attr("x", x0 + segW("present") + segW("partial")).attr("y", yPix).attr("width", segW("missing")).attr("height", BAR_H).attr("fill", "#ef4444");

      g.append("rect").attr("x", x0).attr("y", yPix).attr("width", BAR_W).attr("height", BAR_H).attr("fill", "none").attr("stroke", "#94a3b8").attr("stroke-width", 0.6);
      g.append("text").attr("x", x0 - 6).attr("y", yPix + BAR_H / 2 + 3).attr("text-anchor", "end").attr("font-size", 11).attr("fill", "#e2e8f0").text(`${row.present}/${totalItems}`);
    });

    // ---------- legends ----------
    const legend = g.append("g").attr("transform", `translate(${innerW - 220}, 8)`);
    [
      { sw:1.8, stroke:"#d62728", fill:"none", label:"With Meds (trend)" },
      { sw:1.2, stroke:"#a94442", fill:"#f8bcbc", label:"Meds increase (filled)" },
      { sw:1.4, stroke:"#084594", fill:"#c6dbef", label:"No Meds (baseline)" }
    ].forEach((it,i)=>{
      const y0 = i*18;
      legend.append("rect").attr("x",0).attr("y",y0).attr("width",14).attr("height",10)
        .attr("fill", it.fill === "none" ? "transparent" : it.fill)
        .attr("stroke", it.stroke).attr("stroke-width", it.sw);
      legend.append("text")
        .attr("x",20).attr("y",y0+9).attr("font-size",12)
        .attr("fill", "#e2e8f0")
        .text(it.label);
    });

    const lx = innerW - 220;
    const ly = 8 + 3*18 + 8;
    const completenessLegend = g.append("g").attr("transform", `translate(${lx},${ly})`);
    [
      ["#34d399","Present"],
      ["#f59e0b","Partial"],
      ["#ef4444","Missing"]
    ].forEach((it,i)=>{
      completenessLegend.append("rect").attr("x",0).attr("y",i*16).attr("width",12).attr("height",12).attr("fill",it[0]);
      completenessLegend.append("text")
        .attr("x",18).attr("y",i*16+10).attr("font-size",12)
        .attr("fill", "#e2e8f0")
        .text(it[1]);
    });

    // ---------- axis ----------
    const xAxis = g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5));
    
    xAxis.selectAll("text")
      .attr("fill", "#e2e8f0")
      .attr("font-size", "11px");
    
    xAxis.selectAll("line, path")
      .attr("stroke", "#64748b");
    
    xAxis.append("text")
        .attr("x", innerW).attr("y", 24)
      .attr("fill", "#e2e8f0")
      .attr("text-anchor", "end")
      .attr("font-size", "12px")
      .text("event weight (count)");

    // ---------- Y-axis with phase labels (clickable) ----------
    const phaseLabelMap = {
      home: "Home",
      er: "ER",
      unit: "Unit",
      discharge: "Discharge",
      back_home: "Back Home"
    };

    // Create phase labels at the center of each phase
    phaseOrder.forEach((phaseKey) => {
      if (bounds[phaseKey]) {
        const [y0, y1] = bounds[phaseKey];
        // Since y scale maps [0, innerH] to [0, innerH], bounds are already in pixel coordinates
        // But to be safe and explicit, we'll use the scale
        const centerY = y((y0 + y1) / 2);
        
        // Add clickable phase label text on the left side
        g.append("text")
          .attr("x", -10)
          .attr("y", centerY)
          .attr("text-anchor", "end")
          .attr("font-size", "12px")
          .attr("font-weight", "600")
          .attr("fill", "#93c5fd")
          .attr("cursor", "pointer")
          .style("text-decoration", "underline")
          .text(phaseLabelMap[phaseKey] || phaseKey)
          .on("click", function() {
            if (onPhaseClick) {
              const phaseSection = sections.find(s => s.phase === phaseKey);
              onPhaseClick(phaseKey, phaseSection);
            }
          });
      }
    });

    // ---------- Phase hover areas and tooltip ----------
    const phaseHoverArea = g.append("g").attr("class", "phase-hover-areas");
    const phaseTooltip = g.append("g")
      .attr("class", "phase-tooltip")
      .style("opacity", 0)
      .style("pointer-events", "none");

    const tooltipRect = phaseTooltip.append("rect")
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("fill", "rgba(255, 255, 255, 0.98)")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("filter", "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))");

    const tooltipText = phaseTooltip.append("text")
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .attr("fill", "#1e293b")
      .attr("x", 12)
      .attr("y", 18);

    // Create hover areas for each phase
    phaseOrder.forEach((phaseKey) => {
      if (bounds[phaseKey]) {
        const [y0, y1] = bounds[phaseKey];
        const centerY = (y0 + y1) / 2;
        const phaseLabel = phaseLabelMap[phaseKey] || phaseKey;
        
        // Create invisible hover area covering the y-axis region (clickable)
        // Convert data coordinates to pixel coordinates
        const y0Pixels = y(y0);
        const y1Pixels = y(y1);
        const phaseHeightPixels = y1Pixels - y0Pixels;
        
        const hoverArea = phaseHoverArea.append("rect")
          .attr("x", -margin.left)
          .attr("y", y0Pixels - 5)
          .attr("width", margin.left + 10)
          .attr("height", phaseHeightPixels + 10)
          .attr("fill", "transparent")
          .attr("cursor", "pointer")
          .style("opacity", 0)
          .on("click", function() {
            if (onPhaseClick) {
              const phaseSection = sections.find(s => s.phase === phaseKey);
              onPhaseClick(phaseKey, phaseSection);
            }
          });

        // Get phase info from sections
        const phaseSection = sections.find(s => s.phase === phaseKey);
        
        // Extract event descriptions from section content
        let eventDescriptions = [];
        if (phaseSection && phaseSection.content) {
          const contentLines = phaseSection.content
            .split('\n')
            .filter(line => line.trim().startsWith('•'))
            .slice(0, 3);
          
          eventDescriptions = contentLines.map(line => {
            const cleanLine = line.replace(/^•\s*/, '').trim();
            const match = cleanLine.match(/^[^:]+:\s*(.+)$/);
            if (match) {
              const label = cleanLine.split(':')[0].trim();
              const content = match[1].trim();
              const shortContent = content.length > 30 ? content.substring(0, 27) + "..." : content;
              return `${label}: ${shortContent}`;
            } else {
              return cleanLine.length > 45 ? cleanLine.substring(0, 42) + "..." : cleanLine;
            }
          })
          .filter(desc => desc.length > 0);
        }
        
        const phaseInfo = phaseSection 
          ? { 
              label: phaseSection.label, 
              count: phaseSection.count, 
              content: phaseSection.content,
              events: eventDescriptions
            }
          : { 
              label: phaseLabel, 
              count: 0, 
              content: "",
              events: []
            };

        // Helper function to build tooltip content
        const buildTooltipContent = (info) => {
          const lines = [
            `Phase: ${info.label}`,
            `Events: ${info.count}`
          ];
          if (info.events && info.events.length > 0) {
            lines.push("");
            lines.push("Key Events:");
            lines.push(`• ${info.events[0]}`);
            lines.push(`... and ${info.count - 1} more`);
          }
          return lines;
        };

        // Hover events
        hoverArea
          .on("mouseover", function(event) {
            d3.select(this).attr("fill", "rgba(255, 255, 255, 0.15)").style("opacity", 0.5);
            
            const tooltipLines = buildTooltipContent(phaseInfo);
            const lineHeight = 16;
            const padding = 12;
            
            tooltipText.selectAll("tspan").remove();
            let currentY = 0;
            tooltipLines.forEach((line, i) => {
              const maxCharsPerLine = 35;
              if (line.length > maxCharsPerLine && !line.startsWith("Phase:") && !line.startsWith("Events:") && line !== "Key Events:" && !line.startsWith("...")) {
                const words = line.split(' ');
                let currentLine = '';
                words.forEach((word) => {
                  if ((currentLine + word).length > maxCharsPerLine && currentLine.length > 0) {
                    tooltipText.append("tspan")
                      .attr("x", padding)
                      .attr("dy", i === 0 && currentLine === '' ? 0 : lineHeight)
                      .attr("fill", line.startsWith("•") ? "#475569" : "#1e293b")
                      .attr("font-size", line.startsWith("•") ? "11px" : "12px")
                      .text(currentLine.trim());
                    currentY += lineHeight;
                    currentLine = word + ' ';
                  } else {
                    currentLine += (currentLine ? ' ' : '') + word;
                  }
                });
                if (currentLine.trim()) {
                  tooltipText.append("tspan")
                    .attr("x", padding)
                    .attr("dy", i === 0 && currentY === 0 ? 0 : lineHeight)
                    .attr("fill", line.startsWith("•") ? "#475569" : "#1e293b")
                    .attr("font-size", line.startsWith("•") ? "11px" : "12px")
                    .text(currentLine.trim());
                  currentY += lineHeight;
                }
              } else {
                const tspan = tooltipText.append("tspan")
                  .attr("x", padding)
                  .attr("dy", i === 0 ? 0 : lineHeight);
                
                if (line.startsWith("Phase:") || line.startsWith("Events:") || line === "Key Events:") {
                  tspan.attr("font-weight", "600").attr("fill", "#1e40af").attr("font-size", "12px");
                } else if (line.startsWith("•")) {
                  tspan.attr("fill", "#475569").attr("font-size", "11px");
                } else if (line.startsWith("...")) {
                  tspan.attr("fill", "#64748b").attr("font-style", "italic").attr("font-size", "11px");
                } else {
                  tspan.attr("fill", "#1e293b").attr("font-size", "12px");
                }
                
                tspan.text(line);
                currentY += lineHeight;
              }
            });
            
            const bbox = tooltipText.node().getBBox();
            const maxTooltipWidth = 280;
            const tooltipWidth = Math.min(Math.max(bbox.width + padding * 2, 180), maxTooltipWidth);
            const tooltipX = -margin.left - 10;
            // Convert centerY from data coordinates to pixel coordinates
            const centerYPixels = y(centerY);
            const tooltipY = Math.max(padding, Math.min(innerH - bbox.height - padding * 2, centerYPixels - bbox.height / 2));
            
            tooltipRect
              .attr("x", tooltipX - tooltipWidth)
              .attr("y", tooltipY - padding)
              .attr("width", tooltipWidth)
              .attr("height", bbox.height + padding * 2);
            
            tooltipText
              .attr("x", tooltipX - tooltipWidth + padding)
              .attr("y", tooltipY + padding);
            
            phaseTooltip.attr("transform", `translate(0, 0)`);
            phaseTooltip.style("opacity", 1);
            
            // Convert data coordinates to pixel coordinates for highlight
            const y0Pixels = y(y0);
            const y1Pixels = y(y1);
            const phaseHeightPixels = y1Pixels - y0Pixels;
            
            g.append("rect")
              .attr("x", 0)
              .attr("y", y0Pixels)
              .attr("width", innerW)
              .attr("height", phaseHeightPixels)
              .attr("fill", "rgba(231, 235, 240, 0.2)")
              .attr("pointer-events", "none")
              .attr("class", "phase-highlight");
          })
          .on("mouseout", function() {
            d3.select(this).attr("fill", "transparent").style("opacity", 0);
            phaseTooltip.style("opacity", 0);
            g.selectAll(".phase-highlight").remove();
          });
      }
    });

    // ---------- Chart hover area with centered tooltip ----------
    const chartHoverLayer = g.append("g").attr("class", "chart-hover-layer");
    const chartHoverArea = chartHoverLayer.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .attr("pointer-events", "all")
      .style("cursor", "crosshair");

    // Helper function to find phase from mouse position
    const findPhaseFromMouse = (mouseX, mouseY) => {
      if (mouseX <= 0) return null;
      const invertedY = y.invert(mouseY);
      
      // Find which phase the mouse is over
      let foundPhase = null;
      let phaseCenterY = null;
      for (const phaseKey of phaseOrder) {
        if (bounds[phaseKey]) {
          const [y0, y1] = bounds[phaseKey];
          if (invertedY >= y0 && invertedY <= y1) {
            foundPhase = phaseKey;
            phaseCenterY = (y0 + y1) / 2; // Get phase center Y
            break;
          }
        }
      }
      return { phase: foundPhase, centerY: phaseCenterY };
    };

    // Add click handler to open modal
    chartHoverArea
      .on("click", function(event) {
        const [mouseX, mouseY] = d3.pointer(event, g.node());
        const phaseInfo = findPhaseFromMouse(mouseX, mouseY);
        
        if (phaseInfo && phaseInfo.phase && onPhaseClick) {
          const phaseSection = sections.find(s => s.phase === phaseInfo.phase);
          onPhaseClick(phaseInfo.phase, phaseSection);
        }
      });

    chartHoverArea
      .on("mousemove", function(event) {
        const [mouseX, mouseY] = d3.pointer(event, g.node());
        
        const phaseInfo = findPhaseFromMouse(mouseX, mouseY);
        const hoveredPhase = phaseInfo ? phaseInfo.phase : null;
        const phaseCenterY = phaseInfo ? phaseInfo.centerY : null;
        
        if (hoveredPhase && phaseCenterY !== null) {
          const phaseLabel = phaseLabelMap[hoveredPhase] || hoveredPhase;
          const phaseSection = sections.find(s => s.phase === hoveredPhase);
            
            let eventDescriptions = [];
            if (phaseSection && phaseSection.content) {
              const contentLines = phaseSection.content
                .split('\n')
                .filter(line => line.trim().startsWith('•'))
                .slice(0, 3);
              
              eventDescriptions = contentLines.map(line => {
                const cleanLine = line.replace(/^•\s*/, '').trim();
                const match = cleanLine.match(/^[^:]+:\s*(.+)$/);
                if (match) {
                  const label = cleanLine.split(':')[0].trim();
                  const content = match[1].trim();
                  const shortContent = content.length > 30 ? content.substring(0, 27) + "..." : content;
                  return `${label}: ${shortContent}`;
                } else {
                  return cleanLine.length > 45 ? cleanLine.substring(0, 42) + "..." : cleanLine;
                }
              })
              .filter(desc => desc.length > 0);
            }
            
            const phaseInfo = phaseSection 
              ? { 
                  label: phaseSection.label, 
                  count: phaseSection.count,
                  events: eventDescriptions
                }
              : { 
                  label: phaseLabel, 
                  count: 0,
                  events: []
                };
            
            // Build tooltip content
            const tooltipLines = [
              `Phase: ${phaseInfo.label}`,
              `Events: ${phaseInfo.count}`
            ];
            if (phaseInfo.events && phaseInfo.events.length > 0) {
              tooltipLines.push("");
              tooltipLines.push("Key Events:");
              tooltipLines.push(`• ${phaseInfo.events[0]}`);
              tooltipLines.push(`... and ${phaseInfo.count - 1} more`);
            }
            
            const lineHeight = 16;
            const padding = 12;
            
            // Apply wrapping logic
            tooltipText.selectAll("tspan").remove();
            let currentY = 0;
            tooltipLines.forEach((line, i) => {
              const maxCharsPerLine = 35;
              if (line.length > maxCharsPerLine && !line.startsWith("Phase:") && !line.startsWith("Events:") && line !== "Key Events:" && !line.startsWith("...")) {
                const words = line.split(' ');
                let currentLine = '';
                words.forEach((word) => {
                  if ((currentLine + word).length > maxCharsPerLine && currentLine.length > 0) {
                    tooltipText.append("tspan")
                      .attr("x", padding)
                      .attr("dy", i === 0 && currentLine === '' ? 0 : lineHeight)
                      .attr("fill", line.startsWith("•") ? "#475569" : "#1e293b")
                      .attr("font-size", line.startsWith("•") ? "11px" : "12px")
                      .text(currentLine.trim());
                    currentY += lineHeight;
                    currentLine = word + ' ';
                  } else {
                    currentLine += (currentLine ? ' ' : '') + word;
                  }
                });
                if (currentLine.trim()) {
                  tooltipText.append("tspan")
                    .attr("x", padding)
                    .attr("dy", i === 0 && currentY === 0 ? 0 : lineHeight)
                    .attr("fill", line.startsWith("•") ? "#475569" : "#1e293b")
                    .attr("font-size", line.startsWith("•") ? "11px" : "12px")
                    .text(currentLine.trim());
                  currentY += lineHeight;
                }
              } else {
                const tspan = tooltipText.append("tspan")
                  .attr("x", padding)
                  .attr("dy", i === 0 ? 0 : lineHeight)
                  .text(line);
                
                if (line.startsWith("Phase:") || line.startsWith("Events:") || line === "Key Events:") {
                  tspan.attr("font-weight", "600").attr("fill", "#1e40af").attr("font-size", "12px");
                } else if (line.startsWith("•")) {
                  tspan.attr("fill", "#475569").attr("font-size", "11px");
                } else if (line.startsWith("...")) {
                  tspan.attr("fill", "#64748b").attr("font-style", "italic").attr("font-size", "11px");
                } else {
                  tspan.attr("fill", "#1e293b").attr("font-size", "12px");
                }
                currentY += lineHeight;
              }
            });
            
            const bbox = tooltipText.node().getBBox();
            const maxTooltipWidth = 280;
            const tooltipWidth = Math.min(Math.max(bbox.width + padding * 2, 180), maxTooltipWidth);
            const tooltipX = Math.min(mouseX + 15, innerW - tooltipWidth - 20);
            
            // Center tooltip on phase center Y (phaseCenterY is already in data domain, convert to pixels)
            const phaseCenterYPixels = y(phaseCenterY);
            const tooltipY = Math.max(padding, Math.min(innerH - bbox.height - padding * 2, phaseCenterYPixels - bbox.height / 2));
            
            tooltipRect
              .attr("x", tooltipX)
              .attr("y", tooltipY - padding)
              .attr("width", tooltipWidth)
              .attr("height", bbox.height + padding * 2);
            
            tooltipText
              .attr("x", tooltipX + padding)
              .attr("y", tooltipY + padding);
            
            phaseTooltip.attr("transform", `translate(0, 0)`);
            phaseTooltip.style("opacity", 1);
        } else {
          phaseTooltip.style("opacity", 0);
        }
      })
      .on("mouseout", function() {
        phaseTooltip.style("opacity", 0);
      });
  }, [events, eventsWithMeds, phases, sections]);

  // Handle phase click to open modal
  const handlePhaseClick = useCallback((phaseKey, phaseSection) => {
    const phaseSections = sections.filter(s => s.phase === phaseKey);
    // Get phase label from phases array or phaseSection
    const phase = phases?.find(p => p.key === phaseKey);
    const phaseLabel = phase?.label || phaseSection?.label || phaseKey;
    
    setSelectedPhase({
      key: phaseKey,
      label: phaseLabel,
      sections: phaseSections
    });
    setIsModalOpen(true);
  }, [sections, phases]);

  useEffect(() => {
    if (loading || !containerRef.current) return;
    const chartDiv = containerRef.current.querySelector("#chart");
    if (!chartDiv) return;

    // Let the chart div fill the container - height is handled by CSS
    drawChart(chartDiv, handlePhaseClick);
  }, [loading, events, eventsWithMeds, phases, sections, drawChart, handlePhaseClick]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const chartDiv = containerRef.current.querySelector("#chart");
        if (chartDiv) {
          drawChart(chartDiv, handlePhaseClick);
        }
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawChart, handlePhaseClick]);

  // Parse content into bullet points
  const parseContentToBullets = (content) => {
    if (!content) return [];
    // Split by newlines and filter out empty lines
    const lines = content.split('\n').filter(line => line.trim());
    // Extract bullet points (lines starting with • or lines that are not headers)
    return lines
      .map(line => {
        // Remove bullet prefix if present
        const cleanLine = line.replace(/^•\s*/, '').trim();
        // Extract label and content if it's in "Label: content" format
        const match = cleanLine.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          return { label: match[1].trim(), text: match[2].trim() };
        }
        return { text: cleanLine };
      })
      .filter(item => item.text && item.text.length > 0);
  };

  // Phase icon mapping
  const phaseIcons = {
    home: "🏠",
    er: "🚑",
    unit: "🏥",
    discharge: "📋",
    back_home: "🏡"
  };

  // Get modal content for timeline
  const getTimelineModalContent = () => {
    if (!selectedPhase) return null;

    const allBullets = selectedPhase.sections && selectedPhase.sections.length > 0
      ? selectedPhase.sections.flatMap(section => parseContentToBullets(section.content))
      : [];

    const phaseIcon = phaseIcons[selectedPhase.key] || "📄";

    return {
      title: selectedPhase.label,
      icon: phaseIcon,
      content: allBullets.length > 0 ? (
        <ul className="common-modal-list">
          {allBullets.map((item, i) => (
            <li key={i} className="common-modal-list-item">
              {item.label ? (
                <span>
                  <strong className="common-modal-label">{item.label}:</strong> {item.text}
                </span>
              ) : (
                item.text
              )}
            </li>
          ))}
        </ul>
      ) : null,
      emptyMessage: allBullets.length === 0 ? "No events found for this phase." : null
    };
  };

  if (loading) {
    return (
      <div className="patient-timeline-loading">
        Loading patient data...
      </div>
    );
  }

  const modalData = isModalOpen && selectedPhase ? getTimelineModalContent() : null;

  return (
    <>
      <div ref={containerRef} className="patient-timeline-container">
        <div id="chart" className="patient-timeline-chart"></div>
      </div>
      {modalData && (
        <CommonModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={modalData.title}
          icon={modalData.icon}
          emptyMessage={modalData.emptyMessage}
        >
          {modalData.content}
        </CommonModal>
      )}
    </>
  );
}
