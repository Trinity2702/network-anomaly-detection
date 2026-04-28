import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface AnomalyTableProps {
  anomalies: any[]
}

export function AnomalyTable({ anomalies }: AnomalyTableProps) {
  if (anomalies.length === 0) {
    return <div className="flex justify-center items-center h-40 text-muted-foreground">No anomalies detected yet</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Destination</TableHead>
          <TableHead>Protocol</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {anomalies.map((anomaly, index) => (
          <TableRow key={index}>
            <TableCell>{anomaly.timestamp.toLocaleTimeString()}</TableCell>
            <TableCell>{anomaly.type}</TableCell>
            <TableCell>{typeof anomaly.score === "number" ? anomaly.score.toFixed(4) : anomaly.score}</TableCell>
            <TableCell>{anomaly.source}</TableCell>
            <TableCell>{anomaly.destination}</TableCell>
            <TableCell>{anomaly.protocol}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {anomaly.modelUsed === "one_class_svm"
                  ? "One-Class SVM"
                  : anomaly.modelUsed === "isolation_forest"
                    ? "Isolation Forest"
                    : anomaly.modelUsed === "pca"
                      ? "PCA"
                      : "Autoencoder"}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={anomaly.score > 0.8 ? "destructive" : "default"}>
                {anomaly.score > 0.8 ? "Critical" : "Warning"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
