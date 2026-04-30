"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatSafeNumber } from "@/lib/utils"

interface TrafficChartProps {
  data: any[]
  detailed?: boolean
  selectedFeatures?: string[]
  combined?: boolean
}

const allMetrics = [
  { id: "packetSize", label: "Packet Size (bytes)" },
  { id: "flowDuration", label: "Flow Duration (ms)" },
  { id: "throughput", label: "Throughput (Mbps)" },
  { id: "packetLoss", label: "Packet Loss (%)" },
  { id: "latency", label: "Latency (ms)" },
]

export function TrafficChart({ data, detailed = false, selectedFeatures, combined = false }: TrafficChartProps) {
  const [activeMetrics, setActiveMetrics] = useState<string[]>(
    selectedFeatures || ["packetSize", "throughput", "latency"],
  )
  const [chartType, setChartType] = useState<"line" | "area" | "scatter">("line")

  useEffect(() => {
    if (selectedFeatures) {
      setActiveMetrics(selectedFeatures)
    }
  }, [selectedFeatures])

  const toggleMetric = (metricId: string) => {
    setActiveMetrics((prev) => (prev.includes(metricId) ? prev.filter((id) => id !== metricId) : [...prev, metricId]))
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No traffic data available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex flex-wrap gap-4">
          {allMetrics.map((metric) => (
            <div key={metric.id} className="flex items-center space-x-2">
              <Checkbox
                id={`metric-${metric.id}`}
                checked={activeMetrics.includes(metric.id)}
                onCheckedChange={() => toggleMetric(metric.id)}
              />
              <Label htmlFor={`metric-${metric.id}`}>{metric.label}</Label>
            </div>
          ))}
        </div>

        <Tabs value={chartType} onValueChange={(value) => setChartType(value as any)}>
          <TabsList>
            <TabsTrigger value="line">Line</TabsTrigger>
            <TabsTrigger value="area">Area</TabsTrigger>
            <TabsTrigger value="scatter">Scatter</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {combined ? (
        <div className="h-[300px]">
          <CombinedChart data={data} metrics={activeMetrics} chartType={chartType} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {activeMetrics.map((metricId) => (
            <Card key={metricId}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">
                  {allMetrics.find((m) => m.id === metricId)?.label || metricId}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[200px]">
                  <MetricChart data={data} metricId={metricId} chartType={chartType} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

interface CombinedChartProps {
  data: any[]
  metrics: string[]
  chartType: "line" | "area" | "scatter"
}

function CombinedChart({ data, metrics, chartType }: CombinedChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const colorMap: Record<string, string> = {
    packetSize: "#3b82f6",
    flowDuration: "#10b981",
    throughput: "#8b5cf6",
    packetLoss: "#ef4444",
    latency: "#f59e0b",
  }

  useEffect(() => {
    if (!svgRef.current || data.length === 0 || metrics.length === 0) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const margin = { top: 40, right: 200, bottom: 50, left: 60 } // increased right/bottom for legend and rotated ticks
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    svg.selectAll("*").remove()
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.timestamp) as [Date, Date])
      .range([0, innerWidth])

    const metricRanges: Record<string, [number, number]> = {}
    metrics.forEach((metric) => {
      const values = data.map((d) => d[metric])
      const min = d3.min(values) || 0
      const max = d3.max(values) || 1
      const padding = (max - min) * 0.1
      metricRanges[metric] = [min - padding, max + padding]
    })

    const yScale = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0])

    const normalizeScale: Record<string, d3.ScaleLinear<number, number>> = {}
    metrics.forEach((metric) => {
      normalizeScale[metric] = d3.scaleLinear().domain(metricRanges[metric]).range([0, 1])
    })

    // Draw x-axis (fewer ticks and rotated labels to prevent overlap)
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(4) // fewer ticks on time axis
      .tickFormat(d3.timeFormat("%H:%M:%S") as any)
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-0.4em")
      .attr("dy", "0.15em")
      .attr("transform", "rotate(-30)")

    // Draw y-axis (normalized; keep labels minimal)
    g.append("g").call(
      d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat(() => ""),
    )

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1)
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      )

    metrics.forEach((metric, i) => {
      const line = d3
        .line<any>()
        .x((d) => xScale(d.timestamp))
        .y((d) => yScale(normalizeScale[metric](d[metric])))
        .curve(d3.curveCatmullRom.alpha(0.5))

      if (chartType === "line" || chartType === "area") {
        g.append("path")
          .datum(data)
          .attr("fill", "none")
          .attr("stroke", colorMap[metric] || `hsl(${i * 60}, 70%, 50%)`)
          .attr("stroke-width", 2)
          .attr("d", line)
      }

      if (chartType === "area") {
        const area = d3
          .area<any>()
          .x((d) => xScale(d.timestamp))
          .y0(innerHeight)
          .y1((d) => yScale(normalizeScale[metric](d[metric])))
          .curve(d3.curveCatmullRom.alpha(0.5))

        g.append("path")
          .datum(data)
          .attr("fill", `${colorMap[metric] || `hsl(${i * 60}, 70%, 50%)`}20`)
          .attr("d", area)
      }

      if (chartType === "scatter" || chartType === "line") {
        g.selectAll(`.dot-${metric}`)
          .data(data)
          .enter()
          .append("circle")
          .attr("class", `dot-${metric}`)
          .attr("cx", (d) => xScale(d.timestamp))
          .attr("cy", (d) => yScale(normalizeScale[metric](d[metric])))
          .attr("r", chartType === "scatter" ? 4 : 2)
          .attr("fill", colorMap[metric] || `hsl(${i * 60}, 70%, 50%)`)
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.5)
          .append("title")
          .text((d) => `${metric}: ${formatSafeNumber(d[metric], 2)} at ${d.timestamp.toLocaleTimeString()}`)
      }

      const lastValue = data[data.length - 1][metric]
      g.append("text")
        .attr("x", innerWidth + 20)
        .attr("y", 10 + i * 28)
        .attr("font-size", "10px")
        .attr("fill", colorMap[metric])
        .text(`Current: ${formatSafeNumber(lastValue, 2)}`)
    })

    // Compact boxed legend on the right (no overlap)
    const legendWidth = 170
    const legendItemHeight = 28
    const legendHeight = legendItemHeight * metrics.length + 12
    const legend = g.append("g").attr("transform", `translate(${innerWidth + 10}, 0)`)

    // Legend background
    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", "rgba(255,255,255,0.9)")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.15)

    // Legend items
    metrics.forEach((metric, i) => {
      const group = legend.append("g").attr("transform", `translate(8, ${8 + i * legendItemHeight})`)
      group
        .append("circle")
        .attr("r", 5)
        .attr("cx", 0)
        .attr("cy", 6)
        .attr("fill", colorMap[metric] || `hsl(${i * 60}, 70%, 50%)`)
      group
        .append("text")
        .attr("x", 12)
        .attr("y", 10)
        .attr("font-size", "12px")
        .attr("fill", "currentColor")
        .text(allMetrics.find((m) => m.id === metric)?.label || metric)
    })

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text("Network Traffic Metrics (Normalized)")
  }, [data, metrics, chartType])

  return (
    <div className="w-full h-full bg-white dark:bg-gray-950 rounded-md p-2">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  )
}

interface MetricChartProps {
  data: any[]
  metricId: string
  chartType: "line" | "area" | "scatter"
}

function MetricChart({ data, metricId, chartType }: MetricChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const colorMap: Record<string, string> = {
    packetSize: "#3b82f6",
    flowDuration: "#10b981",
    throughput: "#8b5cf6",
    packetLoss: "#ef4444",
    latency: "#f59e0b",
  }

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const margin = { top: 10, right: 30, bottom: 45, left: 50 } // more bottom space for rotated labels
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    svg.selectAll("*").remove()
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.timestamp) as [Date, Date])
      .range([0, innerWidth])
    const yScale = d3
      .scaleLinear()
      .domain([0, (d3.max(data, (d) => d[metricId]) as number) * 1.1])
      .range([innerHeight, 0])

    const line = d3
      .line<any>()
      .x((d) => xScale(d.timestamp))
      .y((d) => yScale(d[metricId]))
      .curve(d3.curveCatmullRom.alpha(0.5))

    // Draw x-axis (fewer ticks and rotated labels)
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(4)
      .tickFormat(d3.timeFormat("%H:%M:%S") as any)
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-0.4em")
      .attr("dy", "0.15em")
      .attr("transform", "rotate(-30)")

    g.append("g").call(d3.axisLeft(yScale).ticks(5))
    g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1)
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      )

    if (chartType === "line" || chartType === "area") {
      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", colorMap[metricId] || "#3b82f6")
        .attr("stroke-width", 2)
        .attr("d", line)
    }

    if (chartType === "area") {
      g.append("path")
        .datum(data)
        .attr("fill", `${colorMap[metricId] || "#3b82f6"}20`)
        .attr(
          "d",
          d3
            .area<any>()
            .x((d) => xScale(d.timestamp))
            .y0(innerHeight)
            .y1((d) => yScale(d[metricId]))
            .curve(d3.curveCatmullRom.alpha(0.5)),
        )
    }

    if (chartType === "scatter" || chartType === "line") {
      g.selectAll(".dot")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", (d) => xScale(d.timestamp))
        .attr("cy", (d) => yScale(d[metricId]))
        .attr("r", chartType === "scatter" ? 4 : 2)
        .attr("fill", colorMap[metricId] || "#3b82f6")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .append("title")
        .text((d) => `${metricId}: ${formatSafeNumber(d[metricId], 2)} at ${d.timestamp.toLocaleTimeString()}`)
    }
  }, [data, metricId, chartType])

  return (
    <div className="w-full h-full bg-white dark:bg-gray-950 rounded-md p-2">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  )
}
