"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Zap, Target } from "lucide-react"

interface Condition {
  field: string
  operator: string
  value: string
}

interface Action {
  type: string
  value: string
}

interface RuleBuilderProps {
  isOpen: boolean
  onClose: () => void
  onSave: (rule: {
    name: string
    conditions: Condition[]
    actions: Action[]
  }) => Promise<boolean>
  accounts: Array<{ id: string; name: string; type: string }>
  existingRule?: {
    name: string
    conditions: Condition[]
    actions: Action[]
  }
}

export function RuleBuilder({ isOpen, onClose, onSave, accounts, existingRule }: RuleBuilderProps) {
  const [ruleName, setRuleName] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [conditions, setConditions] = useState<Condition[]>([{ field: "description", operator: "contains", value: "" }])
  const [actions, setActions] = useState<Action[]>([{ type: "set_tag", value: "" }])

  const normalizeActions = (ruleActions: Action[]) =>
    ruleActions.map((action) => ({
      ...action,
      value: action.value === undefined || action.value === null ? "" : String(action.value),
    }))

  useEffect(() => {
    if (isOpen) {
      setSaveError("")
      if (existingRule) {
        setRuleName(existingRule.name)
        setConditions(
          existingRule.conditions.length > 0
            ? existingRule.conditions
            : [{ field: "description", operator: "contains", value: "" }],
        )
        setActions(existingRule.actions.length > 0 ? normalizeActions(existingRule.actions) : [{ type: "set_tag", value: "" }])
      } else {
        setRuleName("")
        setConditions([{ field: "description", operator: "contains", value: "" }])
        setActions([{ type: "set_tag", value: "" }])
      }
    }
  }, [isOpen, existingRule])

  const fieldOptions = [
    { value: "description", label: "Deskripsi" },
    { value: "amount", label: "Jumlah" },
    { value: "transaction_type", label: "Jenis Transaksi (Debit/Kredit)" },
    { value: "bank_account_id", label: "Dompet (demo-wallet)" },
  ]

  const operatorOptions = [
    { value: "contains", label: "Berisi" },
    { value: "equals", label: "Sama dengan" },
    { value: "starts_with", label: "Diawali dengan" },
    { value: "ends_with", label: "Diakhiri dengan" },
    { value: "greater_than", label: "Lebih besar dari" },
    { value: "less_than", label: "Lebih kecil dari" },
  ]

  const actionTypes = [
    { value: "set_tag", label: "Atur Tag" },
    { value: "set_account", label: "Tetapkan ke Akun" },
  ]

  const getFieldLabel = (value: string) => fieldOptions.find((option) => option.value === value)?.label || value
  const getOperatorLabel = (value: string) => operatorOptions.find((option) => option.value === value)?.label || value

  const addCondition = () => {
    setConditions([...conditions, { field: "description", operator: "contains", value: "" }])
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, field: keyof Condition, value: string) => {
    const newConditions = [...conditions]
    newConditions[index] = { ...newConditions[index], [field]: value }
    setConditions(newConditions)
  }

  const addAction = () => {
    setActions([...actions, { type: "set_tag", value: "" }])
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const updateAction = (index: number, field: keyof Action, value: string) => {
    const newActions = [...actions]
    newActions[index] = { ...newActions[index], [field]: value }
    setActions(newActions)
  }

  const handleSave = async () => {
    if (!ruleName.trim()) return
    if (conditions.some((c) => !String(c.value || "").trim())) return
    if (actions.some((a) => !String(a.value || "").trim())) return

    setSaving(true)
    setSaveError("")
    try {
      const ok = await onSave({ name: ruleName.trim(), conditions, actions })
      if (ok) onClose()
      else setSaveError("Aturan belum tersimpan. Periksa kondisi dan aksi, lalu coba lagi.")
    } finally { setSaving(false) }
  }

  const canSave =
    ruleName.trim() &&
    conditions.every((c) => String(c.value || "").trim()) &&
    actions.every((a) => String(a.value || "").trim())

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:!max-w-5xl lg:!max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>{existingRule ? "Edit Aturan" : "Buat Aturan Baru"}</span>
          </DialogTitle>
          <DialogDescription>Buat aturan untuk mengategorikan transaksi secara otomatis.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Rule Name */}
          <div>
            <Label htmlFor="rule-name">Nama Aturan</Label>
            <Input
              maxLength={120}
              id="rule-name"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="Contoh: Pembayaran Online"
            />
          </div>

          {/* Conditions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-4 h-4" />
                <span>Kondisi</span>
              </CardTitle>
              <CardDescription>Tentukan kapan aturan ini diterapkan. Semua kondisi harus terpenuhi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {conditions.map((condition, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(11rem,1fr)_minmax(11rem,1fr)_minmax(22rem,2fr)_2.5rem] md:items-center"
                >
                  <Select value={condition.field} onValueChange={(value) => setConditions(current => current.map((item, i) => i === index ? { ...item, field: value, operator: value !== "amount" && ["greater_than", "less_than"].includes(item.operator) ? "contains" : item.operator } : item))}>
                    <SelectTrigger aria-label={`Kolom kondisi ${index + 1}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(value) => updateCondition(index, "operator", value)}
                  >
                    <SelectTrigger aria-label={`Operator kondisi ${index + 1}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operatorOptions.filter(option => condition.field === "amount" || !["greater_than", "less_than"].includes(option.value)).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={condition.value}
                    onChange={(e) => updateCondition(index, "value", e.target.value)}
                    maxLength={500}
                    aria-label={`Nilai kondisi ${index + 1}`}
                    placeholder="Masukkan nilai"
                    className="w-full"
                  />

                  {conditions.length > 1 && (
                    <Button variant="ghost" size="sm" aria-label={`Hapus kondisi ${index + 1}`} onClick={() => removeCondition(index)} className="justify-self-end">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button variant="outline" disabled={conditions.length >= 20} onClick={addCondition} className="w-full bg-transparent">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Kondisi
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Aksi</CardTitle>
              <CardDescription>Tentukan apa yang terjadi ketika kondisi terpenuhi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {actions.map((action, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(14rem,1fr)_minmax(28rem,2fr)_2.5rem] md:items-center"
                >
                  <Select value={action.type} onValueChange={(value) => updateAction(index, "type", value)}>
                    <SelectTrigger aria-label={`Jenis aksi ${index + 1}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {actionTypes.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {action.type === "set_account" ? (
                    <Select
                      value={action.value ? String(action.value) : ""}
                      onValueChange={(value) => updateAction(index, "value", value)}
                    >
                      <SelectTrigger aria-label={`Akun aksi ${index + 1}`} className="w-full">
                        <SelectValue placeholder="Pilih akun" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            <div className="flex items-center space-x-2">
                              <span>{account.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {account.type}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      maxLength={60}
                      aria-label={`Nilai aksi ${index + 1}`}
                      value={action.value}
                      onChange={(e) => updateAction(index, "value", e.target.value)}
                      placeholder="Masukkan nama tag"
                      className="w-full"
                    />
                  )}

                  {actions.length > 1 && (
                    <Button variant="ghost" size="sm" aria-label={`Hapus aksi ${index + 1}`} onClick={() => removeAction(index)} className="justify-self-end">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button variant="outline" disabled={actions.length >= 10} onClick={addAction} className="w-full bg-transparent">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Aksi
              </Button>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Pratinjau Aturan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-sm">
                  <strong>Jika:</strong>{" "}
                  {conditions
                    .map((c) => `${getFieldLabel(c.field)} ${getOperatorLabel(c.operator).toLowerCase()} "${c.value}"`)
                    .join(" DAN ")}
                </p>
                <p className="text-sm mt-2">
                  <strong>Maka:</strong>{" "}
                  {actions
                    .map((a) => {
                      switch (a.type) {
                        case "set_tag":
                          return `beri tag "${a.value}"`
                        case "set_account":
                          return `tetapkan ke akun "${
                            accounts.find((acc) => String(acc.id) === String(a.value))?.name || a.value
                          }"`
                        default:
                          return `${a.type}: ${a.value}`
                      }
                    })
                    .join(", ")}
                </p>
              </div>
            </CardContent>
          </Card>

          {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button onClick={() => void handleSave()} disabled={!canSave || saving}>
              <Zap className="w-4 h-4 mr-2" />
              {saving ? "Menyimpan…" : existingRule ? "Perbarui Aturan" : "Buat Aturan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
