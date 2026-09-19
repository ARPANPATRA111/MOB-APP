import React, { useState } from "react";
import { FlatList } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AppScreen from "../src/components/ui/AppScreen";
import AppButton from "../src/components/ui/AppButton";
import {
  Choices,
  Copy,
  ListRow,
  Notice,
  Panel,
  useAction,
} from "../src/components/ui/CommerceUI";
import { useTheme } from "../src/contexts/ThemeContext";
import { useCurrency } from "../src/contexts/CurrencyContext";
import {
  applyCsvImport,
  previewCsvImport,
} from "../src/repositories/importRepository";
import { createLocalId } from "../src/db/schema";
import { notifyDataChanged } from "../src/services/dataEvents";
import { useDialog } from "../src/components/ui/DialogProvider";
type Preview = Awaited<ReturnType<typeof previewCsvImport>>;
export default function ImportScreen() {
  const { theme } = useTheme();
  const currency = useCurrency();
  const action = useAction();
  const { confirm } = useDialog();
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState<"metadata" | "count">("metadata");
  const [message, setMessage] = useState("");
  const [runId, setRunId] = useState(createLocalId("import"));
  const choose = () =>
    action.run(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "text/plain",
          "application/vnd.ms-excel",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > 10 * 1024 * 1024)
        throw new Error("Import files must be under 10 MB.");
      const text = await FileSystem.readAsStringAsync(asset.uri);
      setCsv(text);
      setPreview(await previewCsvImport(text));
      setRunId(createLocalId("import"));
      setMessage("");
    });
  return (
    <AppScreen theme={theme} scroll={false}>
      <FlatList
        data={preview?.rows ?? []}
        keyExtractor={(r) => r.barcode}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <>
            <Notice message={action.error} error />
            <Notice message={message} />
            <Panel title="Review a product import">
              <Copy muted>
                Required headers: barcode, name, quantity, price. Optional:
                category, unit, costPrice, lowStockThreshold. Photos transfer
                through a full backup.
              </Copy>
              <AppButton
                theme={theme}
                label="Choose CSV file"
                loading={action.busy}
                onPress={choose}
              />
              <AppButton
                theme={theme}
                variant="secondary"
                label="Share CSV template"
                disabled={action.busy}
                onPress={() =>
                  action.run(async () => {
                    const uri =
                      FileSystem.cacheDirectory + "MOPX-products-template.csv";
                    await FileSystem.writeAsStringAsync(
                      uri,
                      "barcode,name,quantity,price,category,unit,costPrice,lowStockThreshold\r\nSKU-001,Sample item,10,25,Grocery,piece,15,3\r\n",
                    );
                    await Sharing.shareAsync(uri, { mimeType: "text/csv" });
                  })
                }
              />
            </Panel>
            {preview && (
              <Panel title="Import preview">
                <Copy>
                  {preview.rows.length} valid products / {preview.errors.length}{" "}
                  errors
                </Copy>
                <Choices<"metadata" | "count">
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "metadata", label: "Keep existing stock" },
                    { value: "count", label: "Apply stock counts" },
                  ]}
                />
                <Copy muted>
                  {mode === "metadata"
                    ? "Existing quantities stay unchanged. New products use the CSV quantity."
                    : "CSV quantities replace existing stock through recorded adjustments."}
                </Copy>
                {preview.warnings.map((w, i) => (
                  <Notice key={i} message={w} />
                ))}
                {preview.errors.slice(0, 30).map((e, i) => (
                  <Notice
                    key={i}
                    error
                    message={`Row ${e.row}: ${e.message}`}
                  />
                ))}
                {preview.errors.length > 30 && (
                  <Copy muted>
                    Fix these errors and choose the file again to review the
                    rest.
                  </Copy>
                )}
                <AppButton
                  theme={theme}
                  label={`Import ${preview.rows.length} products`}
                  disabled={preview.errors.length > 0 || !preview.rows.length}
                  loading={action.busy}
                  onPress={() =>
                    action.run(async () => {
                      if (
                        !(await confirm({
                          title: "Apply reviewed changes?",
                          message: `Import ${preview.rows.length} products. ${mode === "count" ? "Existing stock will be adjusted to the CSV quantities." : "Existing stock quantities will be kept."}`,
                          confirmText: "Import",
                        }))
                      )
                        return;
                      const count = await applyCsvImport({
                        id: runId,
                        csv,
                        mode,
                        versions: preview.versions,
                      });
                      setPreview(null);
                      setCsv("");
                      setMessage(`${count} products imported.`);
                      notifyDataChanged();
                    })
                  }
                />
              </Panel>
            )}
          </>
        }
        renderItem={({ item }) => {
          const old = preview?.existing[item.barcode];
          const unit =
            old && !preview?.columns.includes("unit") ? old.unit : item.unit;
          const cost =
            old && !preview?.columns.includes("costPrice")
              ? old.cost
              : item.costPrice;
          const threshold =
            old && !preview?.columns.includes("lowStockThreshold")
              ? old.lowStockThreshold
              : item.lowStockThreshold;
          return (
            <ListRow
              title={`${old ? "Update" : "New"} / ${item.name}`}
              subtitle={`${item.barcode} / ${unit}\nStock: ${old ? old.quantity + " to " : ""}${old && mode === "metadata" ? old.quantity : item.quantity} / Price: ${old ? currency.format(old.price) + " to " : ""}${currency.format(item.price)}\nCost: ${cost == null ? "Unknown" : currency.format(cost)} / Alert: ${threshold}`}
            />
          );
        }}
      />
    </AppScreen>
  );
}
