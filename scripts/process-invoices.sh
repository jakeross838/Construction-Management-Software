#!/bin/bash
# Process all split invoices through the API

API_BASE="http://localhost:3001"
INVOICE_DIR="/c/Users/Jake/Downloads/split-invoices"

processed=0
failed=0

echo "Processing invoices from $INVOICE_DIR"
echo "=================================================="

for pdf in "$INVOICE_DIR"/*.pdf; do
    filename=$(basename "$pdf")
    echo ""
    echo "Processing: $filename"

    # Call the process endpoint with curl
    response=$(curl -s -X POST "$API_BASE/api/invoices/process" \
        -F "pdf=@$pdf" \
        -H "Accept: application/json" \
        2>&1)

    # Parse response
    invoice_number=$(echo "$response" | grep -o '"invoice_number":"[^"]*"' | cut -d'"' -f4)
    vendor=$(echo "$response" | grep -o '"vendor":{"[^}]*"name":"[^"]*"' | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    amount=$(echo "$response" | grep -o '"amount":"[^"]*"' | cut -d'"' -f4)
    job=$(echo "$response" | grep -o '"job":{"[^}]*"name":"[^"]*"' | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
    status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

    if [[ "$status" != "" ]]; then
        echo "  Invoice: $invoice_number"
        echo "  Vendor: $vendor"
        echo "  Amount: \$$amount"
        echo "  Job: $job"
        echo "  Status: $status"
        ((processed++))
    else
        echo "  Error: $response"
        ((failed++))
    fi

    # Delay between requests
    sleep 3
done

echo ""
echo "=================================================="
echo "Done! Processed: $processed, Failed: $failed"
