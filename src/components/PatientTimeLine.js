import React, { useEffect, useRef, useCallback, useState } from "react";
import * as d3 from "d3";
import { usePatientData } from "../utils/usePatientData";
import CommonModal from "./CommonModal";
import "./PatientTimeLine.css";

export default function PatientTimeLine({ patientNumber = 1 }) {
  const { phases, sections, events, loading } = usePatientData(patientNumber);
  const containerRef = useRef();
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ---------- draw chart (HORIZONTAL - simplified based on Observable code) ----------
  const drawChart = useCallback((chartDiv, onPhaseClick) => {
    if (!chartDiv) return;
    chartDiv.innerHTML = "";
    if (!events || !events.length || !sections || !phases) return;

    // Fixed chart size so it fits on one screen
    const w = chartDiv.clientWidth || 1200;
    const h = chartDiv.clientHeight || 600;

    const margin = { top: 65, right: 30, bottom: 40, left: 50 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const svg = d3.select(chartDiv)
      .append("svg")
      .attr("width", w)
      .attr("height", h);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // ----- aggregate events by phase using sections (which have the count) -----
    const PHASES = ["home", "er", "unit", "discharge", "back_home"];
    const phaseLabels = {
      home: "Home",
      er: "ER",
      unit: "Unit",
      discharge: "Discharge",
      back_home: "BackHome"
    };

    const phaseData = PHASES.map(key => {
      // Get sections for this phase (should be one merged section per phase)
      const phaseSections = sections.filter(s => s.phase === key);
      
      // Calculate total count from sections - use the count property which represents number of items
      let totalCount = 0;
      if (phaseSections.length > 0) {
        // Each merged section has a count representing the number of raw items
        totalCount = phaseSections[0].count ?? 0;
        // Fallback: if count is 0 but content exists, count the bullet points
        if (totalCount === 0 && phaseSections[0].content) {
          const contentLines = phaseSections[0].content.split('\n').filter(l => l.trim().startsWith('•'));
          totalCount = contentLines.length;
        }
      }
      
      // Get events for this phase (for display in tooltip)
      const evs = events.filter(e => e.phase === key);
      
      return {
        phase: key,
        label: phaseLabels[key] || key,
        count: totalCount,
        events: evs,
        sections: phaseSections
      };
    }).filter(d => {
      // Only keep phases that have content (exclude patient_info which has count 0)
      return d.count > 0 && d.phase !== 'patient_info';
    });

    if (!phaseData.length) return;

    // ----- scales -----
    const x = d3.scalePoint()
      .domain(phaseData.map(d => d.label))
      .range([0, innerW])
      .padding(0.5);

    const maxCount = d3.max(phaseData, d => d.count) || 1;
    const y = d3.scaleLinear()
      .domain([0, maxCount * 1.15])
      .nice()
      .range([innerH, 0]);

    // ----- axes -----
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x))
      .call(ax => ax.selectAll("text")
        .attr("fill", "#e2e8f0")
        .attr("font-size", "12px")
        .attr("font-weight", "500")
        .style("cursor", "pointer")
        .on("click", function(event, d) {
          const phaseKey = Object.keys(phaseLabels).find(k => phaseLabels[k] === d);
          if (phaseKey && onPhaseClick) {
            const phaseDataItem = phaseData.find(pd => pd.phase === phaseKey);
            const phaseSections = phaseDataItem?.sections || sections.filter(s => s.phase === phaseKey);
            onPhaseClick(phaseKey, phaseSections);
          }
        }))
      .call(ax => ax.append("text")
        .attr("x", innerW)
        .attr("y", 32)
        .attr("fill", "#93c5fd")
        .attr("font-weight", 600)
        .attr("font-size", "12px")
        .attr("text-anchor", "end")
        .text("Timeline Phase"));

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d")))
      .call(ax => ax.selectAll("text")
      .attr("fill", "#e2e8f0")
        .attr("font-size", "11px"))
      .call(ax => ax.selectAll("line, path")
        .attr("stroke", "#64748b"))
      .call(ax => ax.append("text")
        .attr("x", 0)
        .attr("y", -12)
          .attr("fill", "#93c5fd")
        .attr("font-weight", 600)
        .attr("font-size", "12px")
        .attr("text-anchor", "start")
        .text("Event Count"));

    // ----- line connecting phases with starting and ending points -----
    // Calculate ending point position (a little ahead of last phase, at x-axis)
    const lastPhaseX = phaseData.length > 0 ? x(phaseData[phaseData.length - 1].label) : innerW;
    const spacing = phaseData.length > 1 
      ? (x(phaseData[1].label) - x(phaseData[0].label)) / 2 
      : innerW * 0.1; // 10% of width if only one phase
    const endX = Math.min(innerW, lastPhaseX + spacing);
    
    // Create line data with starting point at y-axis (x=0, y=0) and ending at x-axis
    const lineData = [
      { label: '', count: 0, isStart: true }, // Starting point at y-axis
      ...phaseData,
      { label: '', count: 0, isEnd: true, xPos: endX } // Ending point at x-axis after last phase
    ];

    // Create area generator for filled area under the line
    const area = d3.area()
      .x(d => {
        if (d.isStart) return 0;
        if (d.isEnd) return d.xPos;
        return x(d.label);
      })
      .y0(innerH) // Bottom of the chart (baseline)
      .y1(d => y(d.count)) // Top of the area (line)
      .curve(d3.curveCatmullRom.alpha(0.3));

    // Create line generator
    const line = d3.line()
      .x(d => {
        if (d.isStart) return 0;
        if (d.isEnd) return d.xPos;
        return x(d.label);
      })
      .y(d => y(d.count))
      .curve(d3.curveCatmullRom.alpha(0.3));

    // Add gradient definition for area fill
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "areaGradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0).attr("y1", margin.top)
      .attr("x2", 0).attr("y2", margin.top + innerH);

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "rgba(59, 130, 246, 0.4)")
      .attr("stop-opacity", 0.6);

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "rgba(147, 51, 234, 0.3)")
      .attr("stop-opacity", 0.3);

    // Draw filled area under the line
    g.append("path")
      .datum(lineData)
      .attr("fill", "url(#areaGradient)")
      .attr("stroke", "none")
      .attr("d", area)
      .style("pointer-events", "none");

    // Draw the line on top
    g.append("path")
      .datum(lineData)
      .attr("fill", "none")
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 2.5)
      .attr("d", line)
      .style("pointer-events", "none"); // Line itself doesn't capture events

    // Create invisible hover area over the chart for mouse detection
    const hoverArea = g.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("cursor", "crosshair");

    // Hover indicator elements
    const hoverIndicator = g.append("g")
      .attr("class", "hover-indicator")
      .style("opacity", 0)
      .style("pointer-events", "none");

    const hoverLine = hoverIndicator.append("line")
      .attr("stroke", "#93c5fd")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5");

    const hoverDot = hoverIndicator.append("circle")
      .attr("r", 6)
      .attr("fill", "#93c5fd")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Line hover tooltip
    const lineTooltip = g.append("g")
      .attr("class", "line-tooltip")
      .style("opacity", 0)
      .style("pointer-events", "none");

    const lineTooltipRect = lineTooltip.append("rect")
      .attr("fill", "rgba(30, 41, 59, 0.95)")
      .attr("stroke", "#64748b")
      .attr("rx", 6)
      .attr("ry", 6);

    const lineTooltipText = lineTooltip.append("text")
      .attr("font-size", "11px")
      .attr("fill", "#e2e8f0")
      .attr("x", 8)
      .attr("y", 16);

    // Hover functionality to detect which phase we're over
    hoverArea
      .on("mousemove", function(event) {
        const [mouseX] = d3.pointer(event, g.node());
        
        // Find the closest phase to the mouse X position
        let closestPhase = null;
        let minDistance = Infinity;
        
        phaseData.forEach(phase => {
          const phaseX = x(phase.label);
          const distance = Math.abs(mouseX - phaseX);
          if (distance < minDistance) {
            minDistance = distance;
            closestPhase = phase;
          }
        });

        // Also check if mouse is before first phase or after last phase
        if (phaseData.length > 0) {
          const firstPhaseX = x(phaseData[0].label);
          const lastPhaseX = x(phaseData[phaseData.length - 1].label);
          
          if (mouseX < firstPhaseX && Math.abs(mouseX - firstPhaseX) < minDistance) {
            // Before first phase - show at starting point
            hoverLine
              .attr("x1", 0)
              .attr("x2", 0)
              .attr("y1", 0)
              .attr("y2", innerH);
            hoverDot
              .attr("cx", 0)
              .attr("cy", innerH);
            
            lineTooltipText.selectAll("tspan").remove();
            lineTooltipText.append("tspan")
              .attr("x", 8)
              .attr("font-weight", "600")
              .text("Starting point: 0 events");
            
            const bbox = lineTooltipText.node().getBBox();
            lineTooltipRect
              .attr("x", bbox.x - 4)
              .attr("y", bbox.y - 4)
              .attr("width", bbox.width + 8)
              .attr("height", bbox.height + 8);
            
            lineTooltip
              .attr("transform", `translate(0, ${innerH - bbox.height - 15})`)
              .style("opacity", 1);
            hoverIndicator.style("opacity", 1);
            return;
          }
          
          if (mouseX > lastPhaseX && mouseX <= endX && Math.abs(mouseX - lastPhaseX) < minDistance) {
            // After last phase - show at ending point
            hoverLine
              .attr("x1", endX)
              .attr("x2", endX)
              .attr("y1", 0)
              .attr("y2", innerH);
            hoverDot
              .attr("cx", endX)
              .attr("cy", innerH);
            
            lineTooltipText.selectAll("tspan").remove();
            lineTooltipText.append("tspan")
              .attr("x", 8)
              .attr("font-weight", "600")
              .text("Ending point: 0 events");
            
            const bbox = lineTooltipText.node().getBBox();
            lineTooltipRect
              .attr("x", bbox.x - 4)
              .attr("y", bbox.y - 4)
              .attr("width", bbox.width + 8)
              .attr("height", bbox.height + 8);
            
            lineTooltip
              .attr("transform", `translate(${endX - bbox.width / 2}, ${innerH - bbox.height - 15})`)
              .style("opacity", 1);
            hoverIndicator.style("opacity", 1);
            return;
          }
        }

        // Show closest phase
        if (closestPhase && minDistance < innerW * 0.2) { // Show if reasonably close to a phase
          const phaseX = x(closestPhase.label);
          const phaseY = y(closestPhase.count);
          
          // Show vertical line at the phase position
          hoverLine
            .attr("x1", phaseX)
            .attr("x2", phaseX)
            .attr("y1", 0)
            .attr("y2", innerH);

          // Show dot on the line at the phase position
          hoverDot
            .attr("cx", phaseX)
            .attr("cy", phaseY);

          // Show tooltip
          const textLines = [
            `Phase: ${closestPhase.label}`,
            `Events: ${closestPhase.count}`
          ];

          lineTooltipText.selectAll("tspan").remove();
          textLines.forEach((line, i) => {
            lineTooltipText.append("tspan")
              .attr("x", 8)
              .attr("dy", i === 0 ? 0 : 16)
              .attr("font-weight", i === 0 ? "600" : "400")
              .text(line);
          });

          const bbox = lineTooltipText.node().getBBox();
          lineTooltipRect
            .attr("x", bbox.x - 4)
            .attr("y", bbox.y - 4)
            .attr("width", bbox.width + 8)
            .attr("height", bbox.height + 8);

          lineTooltip
            .attr("transform", `translate(${phaseX - bbox.width / 2}, ${phaseY - bbox.height - 25})`)
            .style("opacity", 1);

          hoverIndicator.style("opacity", 1);
        }
      })
      .on("mouseout", function() {
        hoverIndicator.style("opacity", 0);
        lineTooltip.style("opacity", 0);
      });

    // ----- dots -----
    const selectedPhases = new Set(
      events
        .filter(e => selectedPhase && e.phase === selectedPhase.key)
        .map(e => e.phase)
    );

    const dots = g.selectAll("circle.phase-dot")
      .data(phaseData)
      .join("circle")
      .attr("class", "phase-dot")
      .attr("cx", d => x(d.label))
      .attr("cy", d => y(d.count))
      .attr("r", d => selectedPhases.has(d.phase) ? 8 : 6)
      .attr("fill", d => selectedPhases.has(d.phase) ? "#ff3b30" : "#ff7f50")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("click", function(event, d) {
        const phaseKey = d.phase;
        if (onPhaseClick) {
          // Pass all sections for this phase
          const phaseSections = d.sections || sections.filter(s => s.phase === phaseKey);
          onPhaseClick(phaseKey, phaseSections);
        }
      });

    // simple tooltip
    dots.append("title")
      .text(d => `${d.label}: ${d.count} events`);

    // Hover effects
    const tooltip = g.append("g")
      .attr("class", "phase-tooltip")
      .style("opacity", 0)
      .style("pointer-events", "none");

    const tooltipRect = tooltip.append("rect")
      .attr("fill", "rgba(30, 41, 59, 0.95)")
      .attr("stroke", "#64748b")
      .attr("rx", 6)
      .attr("ry", 6);

    const tooltipText = tooltip.append("text")
      .attr("font-size", "11px")
      .attr("fill", "#e2e8f0")
      .attr("x", 8)
      .attr("y", 16);

    dots
      .on("mouseover", function(event, d) {
        d3.select(this).attr("r", 9);
        
        const textLines = [`${d.label}: ${d.count} events`];
        // Show preview from sections if available
        if (d.sections && d.sections.length > 0) {
          const firstSection = d.sections[0];
          if (firstSection.content) {
            // Get first line of content
            const contentLines = firstSection.content.split('\n').filter(l => l.trim());
            if (contentLines.length > 0) {
              const firstLine = contentLines[0].replace(/^•\s*/, '').trim();
              const preview = firstLine.length > 40 ? firstLine.substring(0, 37) + "..." : firstLine;
              textLines.push(`  ${preview}`);
            }
          }
        } else if (d.events && d.events.length > 0) {
          const firstEvent = d.events[0];
          if (firstEvent.text) {
            const shortText = firstEvent.text.split('\n')[1] || firstEvent.text;
            const preview = shortText.length > 40 ? shortText.substring(0, 37) + "..." : shortText;
            textLines.push(`  ${preview}`);
          }
        }

            tooltipText.selectAll("tspan").remove();
        textLines.forEach((line, i) => {
                    tooltipText.append("tspan")
            .attr("x", 8)
            .attr("dy", i === 0 ? 0 : 16)
            .attr("font-weight", i === 0 ? "600" : "400")
                  .text(line);
            });
            
            const bbox = tooltipText.node().getBBox();
        tooltipRect
          .attr("x", bbox.x - 4)
          .attr("y", bbox.y - 4)
          .attr("width", bbox.width + 8)
          .attr("height", bbox.height + 8);

        tooltip
          .attr("transform", `translate(${x(d.label) - bbox.width / 2}, ${y(d.count) - bbox.height - 20})`)
          .style("opacity", 1);
      })
      .on("mouseout", function(event, d) {
        const isSelected = selectedPhases.has(d.phase);
        d3.select(this).attr("r", isSelected ? 8 : 6);
        tooltip.style("opacity", 0);
      });
  }, [events, phases, sections, selectedPhase]);

  // Handle phase click to open modal
  const handlePhaseClick = useCallback((phaseKey, phaseSectionsOrSection) => {
    // Handle both array and single section
    const phaseSections = Array.isArray(phaseSectionsOrSection) 
      ? phaseSectionsOrSection 
      : phaseSectionsOrSection 
        ? [phaseSectionsOrSection]
        : sections.filter(s => s.phase === phaseKey);
    
    // Get phase label from phases array or first section
    const phase = phases?.find(p => p.key === phaseKey);
    const phaseLabel = phase?.label || phaseSections[0]?.label || phaseKey;
    
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
  }, [loading, events, phases, sections, drawChart, handlePhaseClick]);
  
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
