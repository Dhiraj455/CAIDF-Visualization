import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import * as THREE from "three";
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
  const canvas3DRef = useRef();
  const [grid, setGrid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("2D"); // "2D" or "3D"
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);

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

  // Color function for risk stages
  const getRiskColor = (score) => {
    if (score < 0.5) return "#22C55E"; // Low risk (0.0-0.5) - Green
    if (score < 1.5) return "#F59E0B"; // Medium risk (0.5-1.5) - Orange/Yellow
    return "#EF4444"; // High risk (1.5-3.0) - Red
  };

  // Get color as THREE.Color
  const getRiskColor3D = (score) => {
    if (score < 0.5) return new THREE.Color(0x22C55E); // Green
    if (score < 1.5) return new THREE.Color(0xF59E0B); // Orange
    return new THREE.Color(0xEF4444); // Red
  };

  // Draw 3D Risk Terrain - Matching 2D chart exactly
  const draw3DTerrain = useCallback(() => {
    if (!canvas3DRef.current || loading || grid.length === 0 || riskData.length === 0) return;

    const container = canvas3DRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Clean up previous scene
    if (sceneRef.current) {
      sceneRef.current.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf9fafb);
    sceneRef.current = scene;

    // Camera setup - better angle to see the line
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(6, 4, 6);
    camera.lookAt(0, 1.5, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvas3DRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 8, 5);
    scene.add(directionalLight);

    // Scale factors to match 2D chart
    const xScale = 8; // Width of the chart
    const yScale = 3; // Height scale (0-3 risk range)
    const xOffset = -xScale / 2; // Center horizontally

    // Create 3D line path matching 2D chart exactly
    const points = [];
    riskData.forEach((point, index) => {
      const x = (index / (riskData.length - 1)) * xScale + xOffset;
      const y = point.riskScore * (yScale / 3); // Scale to match 2D (0-3 range)
      const z = 0; // Flat in Z for now
      points.push(new THREE.Vector3(x, y, z));
    });

    // Create smooth curve using CatmullRomCurve3 (matching D3 curveMonotoneX)
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const curvePoints = curve.getPoints(riskData.length * 10); // Smooth curve

    // Create tube geometry along the curve (ribbon effect)
    const tubeGeometry = new THREE.TubeGeometry(curve, curvePoints.length, 0.08, 8, false);
    
    // Create material with gradient colors along the line
    const tubeMaterial = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 50
    });

    // Add vertex colors based on risk scores
    const colors = [];
    const positions = tubeGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const normalizedX = (x - xOffset) / xScale;
      const dataIndex = Math.min(Math.floor(normalizedX * (riskData.length - 1)), riskData.length - 1);
      const risk = riskData[dataIndex]?.riskScore || 0;
      const color = getRiskColor3D(risk);
      colors.push(color.r, color.g, color.b);
    }
    tubeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    scene.add(tube);

    // Add data point markers (spheres) - matching 2D chart points
    const markers = [];
    riskData.forEach((point, index) => {
      const x = (index / (riskData.length - 1)) * xScale + xOffset;
      const y = point.riskScore * (yScale / 3);
      const z = 0;

      // Create sphere marker
      const markerGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const markerMaterial = new THREE.MeshPhongMaterial({ 
        color: getRiskColor3D(point.riskScore),
        shininess: 100,
        emissive: getRiskColor3D(point.riskScore),
        emissiveIntensity: 0.4
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(x, y, z);
      marker.userData = { point, index }; // Store data for tooltips
      scene.add(marker);
      markers.push(marker);

      // Add vertical line from base to point (like in 2D)
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0, z),
        new THREE.Vector3(x, y, z)
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: getRiskColor3D(point.riskScore),
        opacity: 0.3,
        transparent: true
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      scene.add(line);
    });

    // Add reference planes for risk levels (0, 1, 2, 3)
    [0, 1, 2, 3].forEach((level) => {
      const planeGeometry = new THREE.PlaneGeometry(xScale, 0.01);
      const planeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xcccccc,
        opacity: 0.3,
        transparent: true,
        side: THREE.DoubleSide
      });
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(0, level * (yScale / 3), -0.5);
      scene.add(plane);

      // Add label for risk level (using HTML overlays instead of 3D text)
    });

    // Add axes with labels
    // X-axis (Time/Days)
    const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xOffset, 0, 0),
      new THREE.Vector3(xOffset + xScale, 0, 0)
    ]);
    const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 2 });
    const xAxis = new THREE.Line(xAxisGeometry, xAxisMaterial);
    scene.add(xAxis);

    // Y-axis (Risk Score)
    const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xOffset, 0, 0),
      new THREE.Vector3(xOffset, yScale, 0)
    ]);
    const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 2 });
    const yAxis = new THREE.Line(yAxisGeometry, yAxisMaterial);
    scene.add(yAxis);

    // Add grid on base plane
    const gridHelper = new THREE.GridHelper(xScale, riskData.length, 0xcccccc, 0xeeeeee);
    gridHelper.position.set(0, 0, 0);
    scene.add(gridHelper);

    // Add date labels using HTML overlays (via CSS2DRenderer would be better, but simpler approach)
    // Store markers for tooltip interaction
    const tooltipDiv = document.createElement('div');
    tooltipDiv.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.2s;
    `;
    document.body.appendChild(tooltipDiv);

    // Add hover interaction to markers
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMarker = null;

    const onMouseMoveTooltip = (event) => {
      if (isDragging) return; // Don't show tooltip while dragging
      
      const rect = canvas3DRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markers);

      if (intersects.length > 0) {
        const marker = intersects[0].object;
        if (hoveredMarker !== marker) {
          hoveredMarker = marker;
          const { point } = marker.userData;
          const riskLevel = point.riskScore < 0.5 ? "Low Risk" :
                           point.riskScore < 1.5 ? "Medium Risk" : "High Risk";
          
          tooltipDiv.innerHTML = `
            <div style="font-weight:600;margin-bottom:4px;">${point.date} (Day ${point.dayNumber})</div>
            <div style="margin-bottom:4px;">
              <span style="color:${getRiskColor(point.riskScore)};">●</span>
              <strong>Risk Score:</strong> ${point.riskScore.toFixed(2)} (${riskLevel})
            </div>
            <div style="border-top:1px solid rgba(255,255,255,0.3);padding-top:4px;margin-top:4px;font-size:11px;">
              <div>Mobility: ${point.components.Mobility}</div>
              <div>Wound Care: ${point.components.WoundCare}</div>
              <div>Medical Stability: ${point.components.MedicalStability}</div>
              <div>Swallowing: ${point.components.Swallowing}</div>
            </div>
          `;
          tooltipDiv.style.opacity = '1';
        }
        tooltipDiv.style.left = event.clientX + 15 + 'px';
        tooltipDiv.style.top = event.clientY - 80 + 'px';
      } else {
        if (hoveredMarker) {
          hoveredMarker = null;
          tooltipDiv.style.opacity = '0';
        }
      }
    };

    canvas3DRef.current.addEventListener('mousemove', onMouseMoveTooltip);

    // Orbit controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraDistance = 10;
    let cameraAngleX = Math.PI / 4; // 45 degrees
    let cameraAngleY = Math.PI / 4;

    const updateCamera = () => {
      camera.position.x = Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
      camera.position.y = Math.sin(cameraAngleX) * cameraDistance;
      camera.position.z = Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
      camera.lookAt(0, 1.5, 0); // Look at center of chart
    };
    updateCamera();

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
      canvas3DRef.current.style.cursor = 'grabbing';
    };

    const onMouseMoveDrag = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      cameraAngleY -= deltaX * 0.01;
      cameraAngleX += deltaY * 0.01;
      cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, cameraAngleX));

      updateCamera();
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
      canvas3DRef.current.style.cursor = 'grab';
    };

    const onWheel = (e) => {
      e.preventDefault();
      cameraDistance += e.deltaY * 0.01;
      cameraDistance = Math.max(6, Math.min(20, cameraDistance));
      updateCamera();
    };

    canvas3DRef.current.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMoveDrag);
    window.addEventListener('mouseup', onMouseUp);
    canvas3DRef.current.addEventListener('wheel', onWheel);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Store cleanup functions
    const cleanup = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (canvas3DRef.current) {
        canvas3DRef.current.removeEventListener('mousedown', onMouseDown);
        canvas3DRef.current.removeEventListener('wheel', onWheel);
        canvas3DRef.current.removeEventListener('mousemove', onMouseMoveTooltip);
      }
      window.removeEventListener('mousemove', onMouseMoveDrag);
      window.removeEventListener('mouseup', onMouseUp);
      if (tooltipDiv && tooltipDiv.parentNode) {
        tooltipDiv.parentNode.removeChild(tooltipDiv);
      }
    };

    // Return cleanup function
    return cleanup;
  }, [riskData, loading, grid.length]);

  // Draw risk trend graph (2D)
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

    // Sub title - responsive font size (commented out for now)
    // const subtitleFontSize = containerWidth < 600 ? "10px" : "12px";
    
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

    // Legend - positioned below toggle button (top: 10px + ~40px button height + 5px gap = ~55px)
    const legendX = width - margin.right - (containerWidth < 600 ? 80 : containerWidth < 900 ? 100 : 120);
    const legendY = 55; // Position below toggle button
    
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

  // Draw based on view mode
  useEffect(() => {
    let cleanup;
    
    if (viewMode === "3D") {
      cleanup = draw3DTerrain();
    } else {
    drawRiskTrend();
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [viewMode, drawRiskTrend, draw3DTerrain]);

  // Handle window resize for 3D
  useEffect(() => {
    if (viewMode !== "3D" || !rendererRef.current || !cameraRef.current) return;

    const handleResize = () => {
      const container = canvas3DRef.current?.parentElement;
      if (!container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewMode]);

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
      className="risk-trend-container"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {/* View Mode Toggle */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        display: 'flex',
        gap: '4px',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '4px',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={() => setViewMode("2D")}
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            background: viewMode === "2D" ? '#2563EB' : '#F3F4F6',
            color: viewMode === "2D" ? '#fff' : '#6B7280',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: viewMode === "2D" ? '600' : '400',
            transition: 'all 0.2s'
          }}
        >
          2D
        </button>
        <button
          onClick={() => setViewMode("3D")}
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            background: viewMode === "3D" ? '#2563EB' : '#F3F4F6',
            color: viewMode === "3D" ? '#fff' : '#6B7280',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: viewMode === "3D" ? '600' : '400',
            transition: 'all 0.2s'
          }}
        >
          3D
        </button>
      </div>

      {/* 2D View */}
      {viewMode === "2D" && (
        <div 
          ref={containerRef} 
      style={{ width: '100%', height: '100%' }}
    />
      )}

      {/* 3D View */}
      {viewMode === "3D" && (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          {/* Title for 3D View */}
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '8px 16px',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            pointerEvents: 'none'
          }}>
            <div style={{
              fontSize: 'clamp(8px, 1.2vw, 14px)',
              fontWeight: '600',
              color: '#111827',
              textAlign: 'center',
              whiteSpace: 'nowrap'
            }}>
              Patient Discharge Risk Trend
            </div>
          </div>
          
          <canvas 
            ref={canvas3DRef}
            style={{ 
              width: '100%', 
              height: '100%',
              display: 'block',
              cursor: 'grab'
            }}
          />
          {/* 3D Instructions */}
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            zIndex: 100
          }}>
            <div>🖱️ Drag to rotate | Scroll to zoom | Hover points for details</div>
            <div style={{ marginTop: '4px', opacity: 0.8 }}>
              X-axis: Time (Days) | Y-axis: Risk Score (0-3) | Color = Risk Level
            </div>
          </div>
          
          {/* Axis Labels Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '50px',
            left: '10px',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '6px 10px',
            borderRadius: '4px',
            fontSize: '10px',
            color: '#666',
            zIndex: 100,
            fontWeight: '600'
          }}>
            Y: Risk Score (0-3)
          </div>
          
          <div style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '6px 10px',
            borderRadius: '4px',
            fontSize: '10px',
            color: '#666',
            zIndex: 100,
            fontWeight: '600'
          }}>
            X: Days ({riskData[0]?.date} → {riskData[riskData.length - 1]?.date})
          </div>
        </div>
      )}
    </div>
  );
}
