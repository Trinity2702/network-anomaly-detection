"use client"

import { useState } from "react"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface ModelSettingsProps {
  settings: {
    threshold: number
    sensitivity: number
    features: string[]
  }
  onSettingsChange: (settings: any) => void
}

export function ModelSettings({ settings, onSettingsChange }: ModelSettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings)

  const handleThresholdChange = (value: number[]) => {
    setLocalSettings((prev) => ({ ...prev, threshold: value[0] }))
  }

  const handleSensitivityChange = (value: number[]) => {
    setLocalSettings((prev) => ({ ...prev, sensitivity: value[0] }))
  }

  const handleFeatureToggle = (feature: string, checked: boolean) => {
    setLocalSettings((prev) => ({
      ...prev,
      features: checked ? [...prev.features, feature] : prev.features.filter((f) => f !== feature),
    }))
  }

  const handleApply = () => {
    onSettingsChange(localSettings)
  }

  const handleReset = () => {
    setLocalSettings(settings)
  }

  const allFeatures = [
    { id: "packetSize", label: "Packet Size" },
    { id: "packetCount", label: "Packet Count" },
    { id: "flowDuration", label: "Flow Duration" },
    { id: "protocolType", label: "Protocol Type" },
    { id: "srcPort", label: "Source Port" },
    { id: "dstPort", label: "Destination Port" },
    { id: "tcpFlags", label: "TCP Flags" },
    { id: "throughput", label: "Throughput" },
    { id: "packetLoss", label: "Packet Loss" },
    { id: "latency", label: "Latency" },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Anomaly Detection Threshold</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Lower (More Sensitive)</span>
            <span className="text-sm text-muted-foreground">Higher (Less Sensitive)</span>
          </div>
          <Slider
            value={[localSettings.threshold]}
            min={0.05}
            max={0.5}
            step={0.01}
            onValueChange={handleThresholdChange}
          />
          <div className="flex justify-center">
            <span className="text-sm font-medium">Current: {localSettings.threshold.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Model Sensitivity</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Conservative</span>
            <span className="text-sm text-muted-foreground">Aggressive</span>
          </div>
          <Slider
            value={[localSettings.sensitivity]}
            min={0.1}
            max={1}
            step={0.1}
            onValueChange={handleSensitivityChange}
          />
          <div className="flex justify-center">
            <span className="text-sm font-medium">Current: {localSettings.sensitivity.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Features Used for Detection</h3>
        <div className="grid grid-cols-2 gap-4">
          {allFeatures.map((feature) => (
            <div key={feature.id} className="flex items-center space-x-2">
              <Checkbox
                id={feature.id}
                checked={localSettings.features.includes(feature.id)}
                onCheckedChange={(checked) => handleFeatureToggle(feature.id, checked as boolean)}
              />
              <Label htmlFor={feature.id}>{feature.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button onClick={handleApply}>Apply Changes</Button>
      </div>
    </div>
  )
}
