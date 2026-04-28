// Simulates network traffic data for the frontend demo

// Generate random IP address
function generateIP() {
  return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(
    Math.random() * 256,
  )}.${Math.floor(Math.random() * 256)}`
}

// Generate random port number
function generatePort() {
  return Math.floor(Math.random() * 65535)
}

// Generate random protocol
function generateProtocol() {
  const protocols = ["TCP", "UDP", "HTTP", "HTTPS", "DNS", "ICMP"]
  return protocols[Math.floor(Math.random() * protocols.length)]
}

// Generate random traffic data
export function generateTrafficData(count = 10, anomalyProbability = 0.1) {
  const data = []
  const now = new Date()

  for (let i = 0; i < count; i++) {
    const isAnomaly = Math.random() < anomalyProbability

    // Base values for normal traffic
    let packetSize = Math.random() * 1000 + 100 // 100-1100 bytes
    let flowDuration = Math.random() * 200 + 10 // 10-210 ms
    let throughput = Math.random() * 50 + 10 // 10-60 Mbps
    let packetLoss = Math.random() * 0.05 // 0-5% loss
    let latency = Math.random() * 50 + 5 // 5-55 ms

    // Modify values for anomalies
    if (isAnomaly) {
      // Choose which anomaly type to simulate
      const anomalyType = Math.floor(Math.random() * 3)

      switch (anomalyType) {
        case 0: // DDoS-like anomaly
          packetSize *= 0.2 // Smaller packets
          flowDuration *= 0.5 // Shorter flows
          throughput *= 3 // Higher throughput
          packetLoss *= 5 // Higher packet loss
          break
        case 1: // Data exfiltration-like anomaly
          packetSize *= 2.5 // Larger packets
          flowDuration *= 2 // Longer flows
          throughput *= 1.5 // Moderate throughput increase
          break
        case 2: // Scanning-like anomaly
          packetSize *= 0.5 // Smaller packets
          flowDuration *= 0.3 // Very short flows
          latency *= 2 // Higher latency
          break
      }
    }

    // Create timestamp slightly in the past
    const timestamp = new Date(now.getTime() - (count - i) * 1000)

    data.push({
      timestamp,
      packetSize,
      flowDuration,
      throughput,
      packetLoss,
      latency,
      protocol: generateProtocol(),
      source: generateIP(),
      destination: generateIP(),
      sourcePort: generatePort(),
      destinationPort: generatePort(),
      value: Math.random(), // Generic value for visualization
      isAnomaly,
    })
  }

  return data
}

// Detect anomalies in the traffic data
export function detectAnomalies(data: any[], threshold = 0.15) {
  const anomalies: any[] = []

  for (const packet of data) {
    if (packet.isAnomaly) {
      // Calculate a fake anomaly score
      const score = Math.random() * 0.5 + 0.5 // 0.5-1.0 range

      // Only report if above threshold
      if (score > threshold) {
        // Determine anomaly type based on the packet characteristics
        let type = "Unknown"

        if (packet.packetSize < 200 && packet.throughput > 40) {
          type = "Potential DDoS"
        } else if (packet.packetSize > 1500) {
          type = "Data Exfiltration"
        } else if (packet.flowDuration < 30) {
          type = "Port Scanning"
        }

        anomalies.push({
          timestamp: packet.timestamp,
          type,
          score,
          source: packet.source,
          destination: packet.destination,
          protocol: packet.protocol,
        })
      }
    }
  }

  return anomalies
}
