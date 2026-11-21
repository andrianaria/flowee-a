export interface ParsedCSV {
  headers: string[]
  data: string[][]
  headerRowIndex: number
  metadata: string[][]
  rawData?: string[][]
}

export interface BankTemplate {
  id: string
  bank_name: string
  template_name: string
  header_row_index: number
  column_mapping: Record<string, string>
  metadata_patterns: string[]
}

// Common Indonesian bank statement patterns
const BANK_PATTERNS = {
  BCA: ["No. rekening", "Nama", "Periode", "Kode Mata Uang"],
  BRI: ["Informasi Rekening", "No. rekening", "Nama", "Periode"],
  BNI: ["BANK NEGARA INDONESIA", "Rekening", "Nama Nasabah"],
  MANDIRI: [
    "PT BANK MANDIRI",
    "No Rekening",
    "Nama",
    "Posting Date",
    "Debit",
    "Credit",
    "posting date",
    "debit",
    "credit",
  ],
  CIMB: ["CIMB NIAGA", "Account Number", "Account Name"],
}

// Common column header patterns in Indonesian
const COLUMN_PATTERNS = {
  date: ["tanggal", "tgl", "date", "waktu"],
  description: ["keterangan", "deskripsi", "description", "remark", "memo"],
  amount: ["jumlah", "nominal", "amount", "value"],
  balance: ["saldo", "balance"],
  debit: ["debit", "keluar", "pengeluaran"],
  credit: ["kredit", "masuk", "pemasukan"],
  reference: ["referensi", "ref", "reference", "no_ref"],
  branch: ["cabang", "branch", "kantor"],
  transaction_type: ["transaction type", "tipe transaksi", "jenis transaksi", "type"],
}

const BCA_FOOTER_PATTERNS = [
  "saldo awal",
  "mutasi debe",
  "mutasi kredi",
  "saldo akhir",
  "total debet",
  "total kredit",
  "debet",
  "kredit",
]

function normalizeCsvInput(text: string): string {
  // Remove BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  // Unify newlines
  text = text.replace(/\r\n|\n\r/g, "\n")
  // Replace NBSP with normal space
  text = text.replace(/\u00A0/g, " ")
  // Normalize curly quotes to straight quotes
  text = text.replace(/[“”]/g, '"')
  return text
}

export function parseCSVContent(csvText: string): string[][] {

  csvText = normalizeCsvInput(csvText)

  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let quoteChar: string | null = null

  const pushField = () => {
    row.push(field)
    field = ""
  }

  const pushRow = () => {
    if (row.length > 0 && row.some((cell) => cell.length > 0)) {
      rows.push(row)
    }
    row = []
  }

  let i = 0
  while (i < csvText.length) {
    const ch = csvText[i]

    if (inQuotes) {
      if (ch === quoteChar) {
        // Escaped quote: "" -> "
        if (ch === '"' && i + 1 < csvText.length && csvText[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        // Close quote
        inQuotes = false
        quoteChar = null
        i += 1
        // Skip spaces/tabs/NBSP after closing quote before comma/EOL
        while (i < csvText.length && (csvText[i] === " " || csvText[i] === "\t" || csvText[i] === "\u00A0")) {
          i++
        }
        continue
      }
      // Regular char inside quotes
      field += ch
      i += 1
      continue
    }

    // Not in quotes
    if (ch === '"' || ch === "“" || ch === "”") {
      // Only treat as opening quote if field is empty (ignoring leading spaces)
      if (field.trim().length === 0) {
        inQuotes = true
        quoteChar = ch === "“" || ch === "”" ? "”" : '"' // normalize
        field = "" // drop any leading spaces before quote
        i += 1
        continue
      } else {
        // Literal quote inside unquoted field
        field += ch
        i += 1
        continue
      }
    }

    if (ch === ",") {
      if (!inQuotes) {
        pushField()
      } else {
        field += ch
      }
      i += 1
      continue
    }

    if (ch === "\n" || ch === "\r") {
      pushField()
      // consume paired newline
      if (
        (ch === "\r" && i + 1 < csvText.length && csvText[i + 1] === "\n") ||
        (ch === "\n" && i + 1 < csvText.length && csvText[i + 1] === "\r")
      ) {
        i += 2
      } else {
        i += 1
      }
      pushRow()
      continue
    }

    // Regular char
    field += ch
    i += 1
  }

  pushField()
  pushRow()


  return rows
}

function isBCAFooterRow(row: string[]): boolean {
  if (!row || row.length === 0) return false

  const firstCell = row[0]?.toLowerCase().trim() || ""

  // Check if the first cell contains any BCA footer patterns
  return BCA_FOOTER_PATTERNS.some((pattern) => firstCell.includes(pattern))
}

export function detectBankFromContent(data: string[][]): string | null {
  const firstFewRows = data.slice(0, 10).flat().join(" ").toLowerCase()


  for (const [bank, patterns] of Object.entries(BANK_PATTERNS)) {
    const matchedPattern = patterns.find((pattern) => firstFewRows.includes(pattern.toLowerCase()))
    if (matchedPattern) {
      return bank
    }
  }

  const hasDebitCredit = firstFewRows.includes("debit") && firstFewRows.includes("credit")
  const hasPostingDate = firstFewRows.includes("posting date")

  if (hasDebitCredit && hasPostingDate) {
    return "MANDIRI"
  }

  return null
}

export function detectHeaderRow(data: string[][]): number {
  // Look for rows that contain common column headers
  for (let i = 0; i < Math.min(data.length, 15); i++) {
    const row = data[i]
    if (!row || row.length < 2) continue

    const rowText = row.join(" ").toLowerCase()

    // Count how many column patterns match
    let matches = 0
    for (const patterns of Object.values(COLUMN_PATTERNS)) {
      if (patterns.some((pattern) => rowText.includes(pattern))) {
        matches++
      }
    }

    // If we find 2+ column header matches, this is likely the header row
    if (matches >= 2) {
      return i
    }
  }

  // Fallback: assume first row is header
  return 0
}

export function convertIndonesianNumberToFloat(numberString: string): number {
  if (!numberString || typeof numberString !== "string") return 0

  // Remove commas and trim whitespace
  const cleaned = numberString.replace(/,/g, "").trim()

  const num = Number.parseFloat(cleaned)

  // Return 0 if invalid number
  return isNaN(num) ? 0 : num
}

export function parseBCAAmount(amountString: string): { amount: number; type: "CREDIT" | "DEBIT" } {
  const trimmed = amountString.trim()

  if (trimmed.endsWith(" CR")) {
    const amountStr = trimmed.replace(" CR", "").trim()
    return {
      amount: convertIndonesianNumberToFloat(amountStr), // Convert to number
      type: "CREDIT",
    }
  } else if (trimmed.endsWith(" DB")) {
    const amountStr = trimmed.replace(" DB", "").trim()
    return {
      amount: convertIndonesianNumberToFloat(amountStr), // Convert to number
      type: "DEBIT",
    }
  }

  // Default fallback
  return {
    amount: convertIndonesianNumberToFloat(trimmed), // Convert to number
    type: "CREDIT",
  }
}

function normalizeTransactionType(value: unknown): "CREDIT" | "DEBIT" | null {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()

  if (["CR", "CREDIT", "KREDIT", "MASUK"].includes(normalized)) return "CREDIT"
  if (["DB", "DR", "DEBIT", "KELUAR"].includes(normalized)) return "DEBIT"

  return null
}

export function parseMandiriAmount(
  debitAmount: string,
  creditAmount: string,
): { amount: number; type: "CREDIT" | "DEBIT" } {
  const debitNum = convertIndonesianNumberToFloat(debitAmount || "0")
  const creditNum = convertIndonesianNumberToFloat(creditAmount || "0")

  // If debit column has amount, it's a debit transaction
  if (debitNum > 0 && creditNum === 0) {
    return {
      amount: debitNum,
      type: "DEBIT",
    }
  }

  // If credit column has amount, it's a credit transaction
  if (creditNum > 0 && debitNum === 0) {
    return {
      amount: creditNum,
      type: "CREDIT",
    }
  }

  // If both have amounts or both are zero, default to credit with the larger amount
  if (creditNum >= debitNum) {
    return {
      amount: creditNum,
      type: "CREDIT",
    }
  } else {
    return {
      amount: debitNum,
      type: "DEBIT",
    }
  }
}

// Helper function to convert Excel serial dates to readable format
export function convertExcelSerialDate(serialDate: number | string): string {
  const numericValue = typeof serialDate === "string" ? Number(serialDate) : serialDate

  // Check if it's an Excel serial date (typically between 40000-50000 for dates around 2009-2036)
  if (!isNaN(numericValue) && numericValue > 40000 && numericValue < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const actualDate = new Date(excelEpoch.getTime() + numericValue * 24 * 60 * 60 * 1000)

    const year = actualDate.getUTCFullYear()
    const month = String(actualDate.getUTCMonth() + 1).padStart(2, "0")
    const day = String(actualDate.getUTCDate()).padStart(2, "0")

    return `${day}/${month}/${year}`
  }

  return serialDate.toString()
}

export function parseExcelDate(value: string | number): string {
  if (!value) return ""

  const valueStr = value
    .toString()
    .trim()
    .replace(/^['=]+/, "")
    .replace(/^"(.*)"$/, "$1")
    .trim()
  const numericValue = Number(valueStr)

  // Case 1: Excel serial date number (e.g., 46357 for dates around 2026)
  if (!isNaN(numericValue) && numericValue > 40000 && numericValue < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const actualDate = new Date(excelEpoch.getTime() + numericValue * 24 * 60 * 60 * 1000)

    const year = actualDate.getUTCFullYear()
    const month = String(actualDate.getUTCMonth() + 1).padStart(2, "0")
    const day = String(actualDate.getUTCDate()).padStart(2, "0")

    return `${day}/${month}/${year}`
  }

  // Case 2: Already formatted date strings (dd/mm/yyyy, dd-mm-yyyy, etc.)
  // Check for common date patterns
  const datePatterns = [
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/, // dd/mm/yyyy or dd-mm-yyyy
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/, // yyyy/mm/dd or yyyy-mm-dd
    /^(\d{1,2})-([A-Za-z]{3})$/, // dd-Mon (e.g., 01-Dec)
    /^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/, // Mon dd, yyyy
  ]

  for (const pattern of datePatterns) {
    if (pattern.test(valueStr)) {
      // If it already looks like a date, return it as is or reformat
      if (pattern === datePatterns[2]) {
        // Handle dd-Mon format (e.g., 01-Dec)
        // This still needs the year, so we might need to assume current year
        // For now, return as is since we don't have full date
        return valueStr
      }
      return valueStr
    }
  }

  return valueStr
}

export function parseCSVWithIntelligentHeaders(input: string | string[][], selectedBankName?: string): ParsedCSV {

  // Handle string input by parsing it first
  let data: string[][]
  if (typeof input === "string") {
    data = parseCSVContent(input)
  } else {
    data = input
  }


  const headerRowIndex = detectHeaderRow(data)

  const headers = data[headerRowIndex] || []

  const metadata = data.slice(0, headerRowIndex)

  const dataRows = data
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => cell && cell.toString().trim()))
    .filter((row) => !isBCAFooterRow(row))


  const detectedBank = detectBankFromContent(data)

  const isMandiriAccount = selectedBankName && selectedBankName.toLowerCase().includes("mandiri")

  if (isMandiriAccount) {

    // Find the debit and credit columns - case insensitive search
    const debitColumnIndex = headers.findIndex(
      (header) =>
        header &&
        typeof header === "string" &&
        (header.toLowerCase().includes("debit") || header.toLowerCase().includes("keluar")),
    )
    const creditColumnIndex = headers.findIndex(
      (header) =>
        header &&
        typeof header === "string" &&
        (header.toLowerCase().includes("credit") || header.toLowerCase().includes("masuk")),
    )
    const balanceColumnIndex = headers.findIndex(
      (header) =>
        header &&
        typeof header === "string" &&
        (header.toLowerCase().includes("saldo") || header.toLowerCase().includes("balance")),
    )


    if (debitColumnIndex !== -1 && creditColumnIndex !== -1) {

      // Create new headers with Amount and Transaction Type, removing original Debit/Credit
      const newHeaders = [...headers]

      newHeaders[debitColumnIndex] = "Amount"
      newHeaders[creditColumnIndex] = "Transaction Type"

      // Process each data row to combine debit/credit into amount and type
      const processedDataRows = dataRows.map((row) => {
        const newRow = [...row]
        const debitAmount = newRow[debitColumnIndex] || "0"
        const creditAmount = newRow[creditColumnIndex] || "0"

        const parsed = parseMandiriAmount(debitAmount, creditAmount)

        newRow[debitColumnIndex] = parsed.amount.toString()
        newRow[creditColumnIndex] = parsed.type

        // Convert balance to number if present
        if (balanceColumnIndex !== -1 && newRow[balanceColumnIndex]) {
          const balanceNum = convertIndonesianNumberToFloat(newRow[balanceColumnIndex])
          newRow[balanceColumnIndex] = balanceNum.toString()
        }

        return newRow
      })


      return {
        headers: newHeaders,
        data: processedDataRows,
        headerRowIndex,
        metadata,
        rawData: data,
      }
    } else {
    }
  }

  const isBCAAccount = selectedBankName && selectedBankName.toLowerCase().includes("bca")

  if (isBCAAccount) {

    // Find the amount column (usually "Jumlah")
    const amountColumnIndex = headers.findIndex(
      (header) =>
        header &&
        typeof header === "string" &&
        (header.toLowerCase().includes("jumlah") || header.toLowerCase().includes("amount")),
    )

    const balanceColumnIndex = headers.findIndex(
      (header) =>
        header &&
        typeof header === "string" &&
        (header.toLowerCase().includes("saldo") || header.toLowerCase().includes("balance")),
    )

    const explicitTransactionTypeColumnIndex = headers.findIndex(
      (header) =>
        header &&
        typeof header === "string" &&
        COLUMN_PATTERNS.transaction_type.some((pattern) => header.toLowerCase().includes(pattern)),
    )

    const detectedTransactionTypeColumnIndex = headers.findIndex((_, columnIndex) => {
      if (columnIndex === amountColumnIndex) return false

      const values = dataRows.map((row) => row[columnIndex]).filter((value) => String(value || "").trim() !== "")
      if (values.length === 0) return false

      const recognizedValues = values.filter((value) => normalizeTransactionType(value) !== null)
      return recognizedValues.length / values.length >= 0.8
    })

    const transactionTypeColumnIndex =
      explicitTransactionTypeColumnIndex !== -1
        ? explicitTransactionTypeColumnIndex
        : detectedTransactionTypeColumnIndex

    if (amountColumnIndex !== -1) {

      // Normalize BCA amount and transaction type columns. Some BCA exports
      // store CR/DB in a separate blank-header column instead of the amount cell.
      const newHeaders = [...headers]
      newHeaders[amountColumnIndex] = "Amount"
      if (transactionTypeColumnIndex !== -1) {
        newHeaders[transactionTypeColumnIndex] = "Transaction Type"
      } else {
        newHeaders.push("Transaction Type")
      }

      // Process each data row to split amount and convert numbers
      const processedDataRows = dataRows.map((row) => {
        const newRow = [...row]
        if (newRow[amountColumnIndex]) {
          const parsed = parseBCAAmount(newRow[amountColumnIndex])
          const separateType =
            transactionTypeColumnIndex !== -1
              ? normalizeTransactionType(newRow[transactionTypeColumnIndex])
              : null
          newRow[amountColumnIndex] = parsed.amount.toString() // Store as string representation of number
          if (transactionTypeColumnIndex !== -1) {
            newRow[transactionTypeColumnIndex] = separateType || parsed.type
          } else {
            newRow.push(parsed.type)
          }
        } else {
          if (transactionTypeColumnIndex !== -1) {
            newRow[transactionTypeColumnIndex] = normalizeTransactionType(newRow[transactionTypeColumnIndex]) || ""
          } else {
            newRow.push("")
          }
        }

        if (balanceColumnIndex !== -1 && newRow[balanceColumnIndex]) {
          const balanceNum = convertIndonesianNumberToFloat(newRow[balanceColumnIndex])
          newRow[balanceColumnIndex] = balanceNum.toString() // Store as string representation of number
        }

        return newRow
      })


      return {
        headers: newHeaders,
        data: processedDataRows,
        headerRowIndex,
        metadata,
        rawData: data,
      }
    }
  }

  const processedDataRows = dataRows.map((row) => {
    return row.map((cell, index) => {
      const header = headers[index]
      const headerLower = header && typeof header === "string" ? header.toLowerCase().trim() : ""

      if (headerLower.includes("tanggal") || headerLower.includes("date") || headerLower.includes("tgl")) {
        return parseExcelDate(cell)
      }

      // Check if this column contains numeric data (amount, balance, etc.)
      if (
        headerLower.includes("jumlah") ||
        headerLower.includes("amount") ||
        headerLower.includes("saldo") ||
        headerLower.includes("balance") ||
        headerLower.includes("nominal") ||
        headerLower.includes("value")
      ) {
        const numValue = convertIndonesianNumberToFloat(cell)
        return numValue.toString()
      }

      return cell
    })
  })


  return {
    headers,
    data: processedDataRows,
    headerRowIndex,
    metadata,
    rawData: data,
  }
}

export function suggestColumnMapping(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {}

  headers.forEach((header, index) => {
    const headerLower = header && typeof header === "string" ? header.toLowerCase().trim() : ""

    // Find the best match for each column
    for (const [fieldType, patterns] of Object.entries(COLUMN_PATTERNS)) {
      if (patterns.some((pattern) => headerLower.includes(pattern))) {
        mapping[index] = fieldType
        break
      }
    }
  })

  return mapping
}

export function createBankTemplate(
  bankName: string,
  templateName: string,
  headerRowIndex: number,
  columnMapping: Record<string, string>,
  metadata: string[][],
): BankTemplate {
  return {
    id: `${bankName.toLowerCase()}_${Date.now()}`,
    bank_name: bankName,
    template_name: templateName,
    header_row_index: headerRowIndex,
    column_mapping: columnMapping,
    metadata_patterns: metadata.flat().filter(Boolean),
  }
}

export interface ImportMapping {
  date: number
  description: number
  amount: number
  transaction_type: number
  debit: number
  credit: number
  reference: number
}
export interface ImportRow {
  date: string
  description: string
  amount: number
  transaction_type: "CREDIT" | "DEBIT"
  reference?: string
}

export function importDate(value: string): string {
  const parsed = parseExcelDate(value).trim()
  const iso = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(parsed)
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(parsed)
  const parts = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : null
  if (!parts) throw new Error("Tanggal harus YYYY-MM-DD atau DD/MM/YYYY.")
  const date = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
  const actual = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(actual.getTime()) || actual.toISOString().slice(0, 10) !== date) throw new Error("Tanggal tidak valid.")
  return date
}

export function importAmount(value: string): number {
  let input = value.trim().replace(/^Rp\.?\s*/i, "").replace(/\s/g, "")
  if (!input) return 0
  const negative = input.startsWith("(") && input.endsWith(")")
  if (negative) input = `-${input.slice(1, -1)}`
  if (!/^-?\d[\d.,]*$/.test(input)) throw new Error("Nominal tidak valid.")
  const comma = input.lastIndexOf(","), dot = input.lastIndexOf(".")
  if (comma >= 0 && dot >= 0) input = comma > dot ? input.replaceAll(".", "").replace(",", ".") : input.replaceAll(",", "")
  else if (comma >= 0) input = /,\d{1,2}$/.test(input) ? input.replace(",", ".") : input.replaceAll(",", "")
  else if (dot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(input)) input = input.replaceAll(".", "")
  const amount = Number(input)
  if (!Number.isFinite(amount)) throw new Error("Nominal tidak valid.")
  return Math.round(amount * 100) / 100
}

export function mapImportRows(rows: string[][], mapping: ImportMapping): { rows: ImportRow[]; errors: string[] } {
  const result: ImportRow[] = [], errors: string[] = []
  rows.forEach((row, index) => {
    try {
      const cell = (column: number) => column >= 0 ? String(row[column] || "").trim() : ""
      if (mapping.date < 0 || mapping.description < 0) throw new Error("Pilih kolom tanggal dan deskripsi.")
      const description = cell(mapping.description)
      if (!description) throw new Error("Deskripsi wajib diisi.")
      let amount: number, transaction_type: "CREDIT" | "DEBIT"
      if (mapping.debit >= 0 || mapping.credit >= 0) {
        const debit = importAmount(cell(mapping.debit)), credit = importAmount(cell(mapping.credit))
        if (debit < 0 || credit < 0 || (debit > 0) === (credit > 0)) throw new Error("Isi tepat satu nominal debit atau kredit positif.")
        amount = debit || credit; transaction_type = debit > 0 ? "DEBIT" : "CREDIT"
      } else {
        if (mapping.amount < 0) throw new Error("Pilih kolom nominal atau debit/kredit.")
        const signed = importAmount(cell(mapping.amount))
        amount = Math.abs(signed)
        const type = normalizeTransactionType(cell(mapping.transaction_type))
        if (mapping.transaction_type >= 0 && !type) throw new Error("Jenis transaksi harus CREDIT/DEBIT atau MASUK/KELUAR.")
        transaction_type = type || (signed < 0 ? "DEBIT" : "CREDIT")
        if (signed < 0 && type === "CREDIT") throw new Error("Nominal negatif bertentangan dengan jenis CREDIT.")
      }
      if (amount <= 0) throw new Error("Nominal harus lebih dari nol.")
      if (!Number.isSafeInteger(amount)) throw new Error("Nominal IDR harus bilangan bulat yang aman.")
      const reference = cell(mapping.reference)
      result.push({ date: importDate(cell(mapping.date)), description, amount, transaction_type, ...(reference ? { reference } : {}) })
    } catch (error) { errors.push(`Baris ${index + 2}: ${error instanceof Error ? error.message : "Data tidak valid"}`) }
  })
  return { rows: result, errors }
}
