"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Brain, AlertCircle, Play } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { changeActiveModel, trainModel } from "@/lib/api-client"

interface ModelSelectorProps {
  modelsLoaded: {
    autoencoder: boolean
    one_class_svm: boolean
    isolation_forest: boolean
    pca: boolean
  }
  activeModel: string
  onModelChange?: (modelType: string) => void
}

export function ModelSelector({ modelsLoaded, activeModel, onModelChange }: ModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState(activeModel)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSelectedModel(activeModel)
  }, [activeModel])

  const isTrained = (m: string) => modelsLoaded[m as keyof typeof modelsLoaded]

  const handleApply = async () => {
    setError(null)
    setNotice(null)

    if (isTrained(selectedModel)) {
      changeActiveModel(selectedModel)
      onModelChange?.(selectedModel)
      setNotice(`Switched to ${pretty(selectedModel)}.`)
      return
    }

    // Not trained: train and switch automatically
    try {
      setBusy(true)
      setNotice(`"${pretty(selectedModel)}" not trained. Starting training and will switch on completion...`)
      await trainModel({ model_type: selectedModel, dataset_size: 3000, set_active_when_done: true })
    } catch (e: any) {
      setError(`Failed to start training: ${e?.message ?? e}`)
    } finally {
      setBusy(false)
    }
  }

  const pretty = (s: string) =>
    s === "one_class_svm" ? "One-Class SVM" : s === "isolation_forest" ? "Isolation Forest" : s.toUpperCase()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Detection Model</CardTitle>
        <CardDescription>Choose a model. If it isn’t trained, we’ll train and switch automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert>
            <Play className="h-4 w-4" />
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <RadioGroup value={selectedModel} onValueChange={setSelectedModel}>
          {[
            { id: "autoencoder", label: "Autoencoder" },
            { id: "one_class_svm", label: "One-Class SVM" },
            { id: "isolation_forest", label: "Isolation Forest" },
            { id: "pca", label: "PCA" },
          ].map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <RadioGroupItem value={m.id} id={m.id} />
              <Label htmlFor={m.id} className="flex items-center gap-2">
                {m.label}
                {isTrained(m.id) ? (
                  <span className="text-xs text-green-500">(Trained)</span>
                ) : (
                  <span className="text-xs text-amber-500">(Not trained)</span>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="pt-2">
          <Button onClick={handleApply} disabled={busy && selectedModel !== activeModel}>
            <Brain className="mr-2 h-4 w-4" />
            {isTrained(selectedModel) ? "Apply Model" : "Train and Switch"}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>Autoencoder: learns to reconstruct normal patterns. High reconstruction error indicates an anomaly.</p>
          <p>One-Class SVM: boundary around normal data; outside points are anomalies.</p>
          <p>Isolation Forest: isolates anomalies with fewer partitions.</p>
          <p>PCA: reconstruction error after dimensionality reduction.</p>
        </div>
      </CardContent>
    </Card>
  )
}
