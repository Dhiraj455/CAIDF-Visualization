import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import "./ReadinessHeatGrid.css";

const tasks = ["Mobility", "WoundCare", "MedicalStability", "Swallowing", "Education", "SocialSupport"];
const dates = ["5/4", "5/5", "5/6", "5/7", "5/8", "5/9", "5/10", "5/11"];

const grid = [
  { Date: "5/4", Mobility: 0, WoundCare: 1, MedicalStability: 1, Swallowing: 0, Education: 0, SocialSupport: 0 },
  { Date: "5/5", Mobility: 1, WoundCare: 1, MedicalStability: 1, Swallowing: 1, Education: 0, SocialSupport: 0 },
  { Date: "5/6", Mobility: 1, WoundCare: 2, MedicalStability: 2, Swallowing: 2, Education: 0, SocialSupport: 0 },
  { Date: "5/7", Mobility: 2, WoundCare: 2, MedicalStability: 2, Swallowing: 2, Education: 1, SocialSupport: 1 },
  { Date: "5/8", Mobility: 2, WoundCare: 2, MedicalStability: 2, Swallowing: 2, Education: 1, SocialSupport: 1 },
  { Date: "5/9", Mobility: 2, WoundCare: 2, MedicalStability: 3, Swallowing: 2, Education: 2, SocialSupport: 2 },
  { Date: "5/10", Mobility: 3, WoundCare: 3, MedicalStability: 3, Swallowing: 3, Education: 3, SocialSupport: 3 },
  { Date: "5/11", Mobility: 3, WoundCare: 3, MedicalStability: 3, Swallowing: 3, Education: 3, SocialSupport: 3 }
];

export default function ReadinessHeatGrid() {
  const containerRef = useRef();

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    d3.select(container).selectAll("svg").remove();

    const containerWidth = container.clientWidth || 600;
    const containerHeight = 430; // Fixed height
    
    // Calculate cell size to fit within 430px height
    const gap = 5;
    
    // Reserve space for labels and title
    const titleHeight = 40;
    const dateLabelHeight = 75; // Space for rotated date labels
    const taskLabelWidth = 110; // Space for task labels
    
    // Available space for grid (excluding labels)
    const availableWidth = containerWidth - taskLabelWidth - 30; // 20 for right padding
    const availableHeight = containerHeight - titleHeight - dateLabelHeight;
    
    // Calculate cell size based on available space
    const maxCellSizeByWidth = (availableWidth - (dates.length - 1) * gap) / dates.length;
    const maxCellSizeByHeight = (availableHeight - (tasks.length - 1) * gap) / tasks.length;
    const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight);
    
    // Calculate actual grid dimensions
    const gridWidth = dates.length * cellSize + (dates.length - 1) * gap;
    const gridHeight = tasks.length * cellSize + (tasks.length - 1) * gap;
    
    // Center the grid horizontally and vertically
    // Left margin for task labels
    const leftMargin = taskLabelWidth;
    const gridLeft = leftMargin;
    const gridRight = gridLeft + gridWidth;
    
    // Top margin for title
    const topMargin = titleHeight + 5;
    // Bottom margin for date labels
    const bottomMargin = dateLabelHeight;
    // Center grid vertically in available space
    const availableVerticalSpace = containerHeight - topMargin - bottomMargin;
    const verticalOffset = (availableVerticalSpace - gridHeight) / 2;
    const gridTop = topMargin + verticalOffset;
    const gridBottom = gridTop + gridHeight;
    
    const width = containerWidth;
    const height = containerHeight;

    // Date scale - range based on grid dimensions
    const x = d3.scaleBand()
      .domain(dates)
      .range([gridLeft, gridRight])
      .paddingInner(gap / (cellSize + gap));

    // Tasks scale - range based on grid dimensions
    const y = d3.scaleBand()
      .domain(tasks)
      .range([gridTop, gridBottom])
      .paddingInner(gap / (cellSize + gap));

    const color = d3.scaleOrdinal()
      .domain([0, 1, 2, 3])
      .range(["#d73027", "#fc8d59", "#fee08b", "#1a9850"]);

    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("font-family", "sans-serif");

    // Title - centered on container width
    svg.append("text")
      .attr("x", containerWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("font-weight", "600")
      .attr("fill", "#f1f5f9")
      .text("Readiness Heat Grid");

    // X axis - positioned at bottom of grid
    svg.append("g")
      .attr("transform", `translate(0,${gridBottom + 10})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .style("font-size", "13px")
      .style("font-weight", "500")
      .style("text-anchor", "end")
      .attr("transform", "rotate(-45)")
      .attr("dx", "-10px")
      .attr("dy", "3px")
      .attr("fill", "#e2e8f0");

    // Y axis - positioned at left of grid
    svg.append("g")
      .attr("transform", `translate(${gridLeft - 10},0)`)
      .call(d3.axisLeft(y).tickSize(0))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .style("font-size", "13px")
      .style("font-weight", "500")
      .attr("fill", "#e2e8f0");

    // Tooltip
    const tooltip = d3.select(document.body)
      .append("div")
      .attr("class", "heatmap-tooltip")
      .style("position", "fixed")
      .style("pointer-events", "none")
      .style("background", "rgba(0,0,0,.8)")
      .style("color", "#fff")
      .style("padding", "6px 10px")
      .style("border-radius", "4px")
      .style("font-size", "13px")
      .style("opacity", 0)
      .style("z-index", "1000");

    function showTip(event, d) {
      const readinessLabels = ["Not Started", "In Progress", "Near Ready", "Ready"];
      tooltip.style("opacity", 1)
        .html(`<b>${d.task}</b><br>Date: ${d.date}<br>Status: ${readinessLabels[d.value]}`)
        .style("left", (event.clientX + 12) + "px")
        .style("top", (event.clientY - 10) + "px");
    }
    function moveTip(event) {
      tooltip.style("left", (event.clientX + 12) + "px").style("top", (event.clientY - 10) + "px");
    }
    function hideTip() {
      tooltip.style("opacity", 0);
    }

    // Transform grid data
    const data = grid.flatMap(row => tasks.map(t => ({
      date: row.Date,
      task: t,
      value: +row[t]
    })));

    svg.selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", d => x(d.date))
      .attr("y", d => y(d.task))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", 6) // Increased border radius
      .attr("ry", 6)
      .attr("fill", d => color(d.value))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2.5) // Slightly thicker border
      .style("cursor", "pointer")
      .on("pointerenter", showTip)
      .on("pointermove", moveTip)
      .on("pointerleave", hideTip)
      .on("click", (event, d) => {
        d.value = (d.value + 1) % 4;
        d3.select(event.currentTarget).attr("fill", color(d.value));
      });

    // Cleanup function
    return () => {
      d3.select(document.body).selectAll(".heatmap-tooltip").remove();
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        d3.select(container).selectAll("svg").remove();

        const containerWidth = container.clientWidth || 600;
        const containerHeight = 430; // Fixed height
        
        const gap = 5;
        
        // Reserve space for labels and title
        const titleHeight = 40;
        const dateLabelHeight = 75; // Space for rotated date labels
        const taskLabelWidth = 140; // Space for task labels
        
        // Available space for grid (excluding labels)
        const availableWidth = containerWidth - taskLabelWidth - 20; // 20 for right padding
        const availableHeight = containerHeight - titleHeight - dateLabelHeight;
        
        // Calculate cell size based on available space
        const maxCellSizeByWidth = (availableWidth - (dates.length - 1) * gap) / dates.length;
        const maxCellSizeByHeight = (availableHeight - (tasks.length - 1) * gap) / tasks.length;
        const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight);
        
        // Calculate actual grid dimensions
        const gridWidth = dates.length * cellSize + (dates.length - 1) * gap;
        const gridHeight = tasks.length * cellSize + (tasks.length - 1) * gap;
        
        // Center the grid horizontally and vertically
        // Left margin for task labels
        const leftMargin = taskLabelWidth;
        const gridLeft = leftMargin;
        const gridRight = gridLeft + gridWidth;
        
        // Top margin for title
        const topMargin = titleHeight + 5;
        // Bottom margin for date labels
        const bottomMargin = dateLabelHeight;
        // Center grid vertically in available space
        const availableVerticalSpace = containerHeight - topMargin - bottomMargin;
        const verticalOffset = (availableVerticalSpace - gridHeight) / 2;
        const gridTop = topMargin + verticalOffset;
        const gridBottom = gridTop + gridHeight;
        
        const width = containerWidth;
        const height = containerHeight;

        const x = d3.scaleBand()
          .domain(dates)
          .range([gridLeft, gridRight])
          .paddingInner(gap / (cellSize + gap));

        const y = d3.scaleBand()
          .domain(tasks)
          .range([gridTop, gridBottom])
          .paddingInner(gap / (cellSize + gap));

        const color = d3.scaleOrdinal()
          .domain([0, 1, 2, 3])
          .range(["#d73027", "#fc8d59", "#fee08b", "#1a9850"]);

        const svg = d3.select(container)
          .append("svg")
          .attr("width", width)
          .attr("height", height)
          .style("font-family", "sans-serif");

        svg.append("text")
          .attr("x", containerWidth / 2)
          .attr("y", 30)
          .attr("text-anchor", "middle")
          .attr("font-size", "18px")
          .attr("font-weight", "600")
          .attr("fill", "#f1f5f9")
          .text("Readiness Heat Grid");

        svg.append("g")
          .attr("transform", `translate(0,${gridBottom + 10})`)
          .call(d3.axisBottom(x).tickSize(0))
          .call(g => g.select(".domain").remove())
          .selectAll("text")
          .style("font-size", "13px")
          .style("font-weight", "500")
          .style("text-anchor", "end")
          .attr("transform", "rotate(-45)")
          .attr("dx", "-10px")
          .attr("dy", "3px")
          .attr("fill", "#e2e8f0");

        svg.append("g")
          .attr("transform", `translate(${gridLeft - 10},0)`)
          .call(d3.axisLeft(y).tickSize(0))
          .call(g => g.select(".domain").remove())
          .selectAll("text")
          .style("font-size", "13px")
          .style("font-weight", "500")
          .attr("fill", "#e2e8f0");

        const tooltip = d3.select(document.body)
          .select(".heatmap-tooltip")
          .node() ? d3.select(document.body).select(".heatmap-tooltip") :
          d3.select(document.body)
            .append("div")
            .attr("class", "heatmap-tooltip")
            .style("position", "fixed")
            .style("pointer-events", "none")
            .style("background", "rgba(0,0,0,.8)")
            .style("color", "#fff")
            .style("padding", "6px 10px")
            .style("border-radius", "4px")
            .style("font-size", "13px")
            .style("opacity", 0)
            .style("z-index", "1000");

        function showTip(event, d) {
          const readinessLabels = ["Not Started", "In Progress", "Near Ready", "Ready"];
          tooltip.style("opacity", 1)
            .html(`<b>${d.task}</b><br>Date: ${d.date}<br>Status: ${readinessLabels[d.value]}`)
            .style("left", (event.clientX + 12) + "px")
            .style("top", (event.clientY - 10) + "px");
        }
        function moveTip(event) {
          tooltip.style("left", (event.clientX + 12) + "px").style("top", (event.clientY - 10) + "px");
        }
        function hideTip() {
          tooltip.style("opacity", 0);
        }

        const data = grid.flatMap(row => tasks.map(t => ({
          date: row.Date,
          task: t,
          value: +row[t]
        })));

        svg.selectAll("rect")
          .data(data)
          .join("rect")
          .attr("x", d => x(d.date))
          .attr("y", d => y(d.task))
          .attr("width", x.bandwidth())
          .attr("height", y.bandwidth())
          .attr("rx", 6)
          .attr("ry", 6)
          .attr("fill", d => color(d.value))
          .attr("stroke", "#fff")
          .attr("stroke-width", 2.5)
          .style("cursor", "pointer")
          .on("pointerenter", showTip)
          .on("pointermove", moveTip)
          .on("pointerleave", hideTip)
          .on("click", (event, d) => {
            d.value = (d.value + 1) % 4;
            d3.select(event.currentTarget).attr("fill", color(d.value));
          });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div ref={containerRef} className="readiness-heatgrid-container"></div>
  );
}

