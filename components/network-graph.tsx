"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"

interface NetworkGraphProps {
  data: any[]
  anomalies: any[]
}

export function NetworkGraph({ data, anomalies }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Clear previous graph
    svg.selectAll("*").remove()

    // Create a set of anomaly timestamps for quick lookup
    const anomalyTimestamps = new Set(anomalies.map((a) => a.timestamp.getTime()))

    // Create nodes for the network graph
    const nodes = data.map((d, i) => ({
      id: i,
      timestamp: d.timestamp,
      isAnomaly: anomalyTimestamps.has(d.timestamp.getTime()),
      value: d.value,
      x: Math.random() * width,
      y: Math.random() * height,
    }))

    // Create links between consecutive nodes
    const links = nodes.slice(1).map((node, i) => ({
      source: i,
      target: i + 1,
      value: 1,
    }))

    // Create a force simulation
    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(links as any)
          .id((d: any) => d.id)
          .distance(30),
      )
      .force("charge", d3.forceManyBody().strength(-50))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(10))

    // Draw links
    const link = svg
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => Math.sqrt(d.value))

    // Draw nodes
    const node = svg
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", (d: any) => (d.isAnomaly ? 8 : 5))
      .attr("fill", (d: any) => (d.isAnomaly ? "#ef4444" : "#3b82f6"))
      .attr("stroke", (d: any) => (d.isAnomaly ? "#b91c1c" : "#2563eb"))
      .attr("stroke-width", 1.5)
      .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended) as any)

    // Add tooltips
    node
      .append("title")
      .text((d: any) => `${d.isAnomaly ? "ANOMALY: " : ""}Packet at ${d.timestamp.toLocaleTimeString()}`)

    // Update positions on each tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => (d.source as any).x)
        .attr("y1", (d: any) => (d.source as any).y)
        .attr("x2", (d: any) => (d.target as any).x)
        .attr("y2", (d: any) => (d.target as any).y)

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y)
    })

    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: any) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    return () => {
      simulation.stop()
    }
  }, [data, anomalies])

  return (
    <div className="w-full h-full">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  )
}
