# QuickBooks Desktop Integration Plan

## Overview
Full two-way sync between Ross Built Invoice System and QuickBooks Desktop. When invoices are approved, bills are automatically created in QuickBooks. When bills are paid in QuickBooks, the invoice is marked as "Paid to Vendor" in our system.

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Ross Built Server  │◄───►│  Web Connector   │◄───►│ QuickBooks      │
│  (Node.js + SOAP)   │     │  (Windows App)   │     │ Desktop         │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────────┐
│  Supabase DB        │
│  - qb_sync_queue    │
│  - qb_vendor_map    │
│  - qb_bill_map      │
└─────────────────────┘
```

### How QuickBooks Web Connector Works
1. QBWC is installed on the same Windows machine as QuickBooks Desktop
2. User registers your app's .qwc file with Web Connector
3. Web Connector polls your SOAP endpoint every X minutes
4. Your server returns qbXML requests (create bill, query payments, etc.)
5. Web Connector executes them in QuickBooks and returns results
6. QuickBooks Desktop must be open for sync to work

---

## Database Schema Changes

### New Tables

```sql
-- Sync queue for pending QB operations
CREATE TABLE qb_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL,           -- 'create_bill', 'query_payments', 'create_vendor'
  entity_type TEXT NOT NULL,         -- 'invoice', 'vendor'
  entity_id UUID NOT NULL,
  payload JSONB,                      -- qbXML request data
  status TEXT DEFAULT 'pending',      -- pending, processing, completed, failed
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  qb_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Vendor mapping between systems
CREATE TABLE qb_vendor_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES v2_vendors(id),
  qb_list_id TEXT NOT NULL,           -- QuickBooks ListID
  qb_name TEXT,                       -- Name in QuickBooks
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bill mapping (invoice → QB bill)
CREATE TABLE qb_bill_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES v2_invoices(id),
  qb_txn_id TEXT NOT NULL,            -- QuickBooks TxnID
  qb_bill_number TEXT,
  qb_amount DECIMAL(12,2),
  is_paid BOOLEAN DEFAULT FALSE,
  paid_amount DECIMAL(12,2),
  paid_date DATE,
  check_number TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Invoice Table Changes

```sql
ALTER TABLE v2_invoices ADD COLUMN qb_synced BOOLEAN DEFAULT FALSE;
ALTER TABLE v2_invoices ADD COLUMN qb_txn_id TEXT;
ALTER TABLE v2_invoices ADD COLUMN paid_to_vendor BOOLEAN DEFAULT FALSE;
ALTER TABLE v2_invoices ADD COLUMN paid_to_vendor_date DATE;
ALTER TABLE v2_invoices ADD COLUMN paid_to_vendor_amount DECIMAL(12,2);
ALTER TABLE v2_invoices ADD COLUMN paid_to_vendor_ref TEXT;  -- check number, etc.
```

---

## Server Components

### 1. QBWC SOAP Endpoint
**File:** `server/quickbooks/qbwc-server.js`

Implements the QBWC SOAP interface:
- `serverVersion()` - Returns server version
- `clientVersion()` - Validates client version
- `authenticate()` - Validates username/password, returns session ticket
- `sendRequestXML()` - Returns next qbXML request from queue
- `receiveResponseXML()` - Processes QB response, updates records
- `closeConnection()` - Cleanup
- `connectionError()` - Handle errors
- `getLastError()` - Return error details

### 2. qbXML Builder
**File:** `server/quickbooks/qbxml-builder.js`

Functions to build qbXML requests:
- `buildBillAddRequest(invoice, vendor)` - Create bill from approved invoice
- `buildBillQueryRequest(filters)` - Query existing bills
- `buildBillPaymentQueryRequest(dateRange)` - Query bill payments
- `buildVendorQueryRequest()` - Get all vendors from QB
- `buildVendorAddRequest(vendor)` - Create vendor in QB

### 3. qbXML Parser
**File:** `server/quickbooks/qbxml-parser.js`

Functions to parse qbXML responses:
- `parseBillAddResponse(xml)` - Extract TxnID, status
- `parseBillQueryResponse(xml)` - Extract bill details
- `parseBillPaymentQueryResponse(xml)` - Extract payment info
- `parseVendorQueryResponse(xml)` - Extract vendor list
- `parseErrorResponse(xml)` - Extract error details

### 4. Sync Manager
**File:** `server/quickbooks/sync-manager.js`

Orchestrates the sync process:
- `queueBillCreation(invoiceId)` - Called when invoice approved
- `processQueue()` - Get next pending item
- `handleBillCreated(invoiceId, qbTxnId)` - Update mapping
- `syncPayments()` - Query QB for recent payments, update invoices
- `syncVendors()` - Sync vendor list between systems
- `retryFailed()` - Retry failed operations

---

## Sync Flows

### Flow 1: Invoice Approved → Create Bill in QB

```
1. Invoice status changes to 'approved'
2. Server calls queueBillCreation(invoiceId)
3. Creates entry in qb_sync_queue:
   - operation: 'create_bill'
   - entity_type: 'invoice'
   - entity_id: invoice.id
   - payload: { vendor_id, amount, invoice_number, date, line_items }
   - status: 'pending'

4. Web Connector polls /qbwc/soap
5. authenticate() validates credentials
6. sendRequestXML() returns BillAddRq:

   <?xml version="1.0"?>
   <?qbxml version="13.0"?>
   <QBXML>
     <QBXMLMsgsRq onError="stopOnError">
       <BillAddRq>
         <BillAdd>
           <VendorRef>
             <ListID>80000001-1234567890</ListID>
           </VendorRef>
           <TxnDate>2026-01-08</TxnDate>
           <RefNumber>INV-105324</RefNumber>
           <Memo>Drummond-501 74th St</Memo>
           <ExpenseLineAdd>
             <AccountRef>
               <FullName>Job Costs:Materials</FullName>
             </AccountRef>
             <Amount>28252.42</Amount>
             <Memo>13101 - Electrical Labor</Memo>
           </ExpenseLineAdd>
         </BillAdd>
       </BillAddRq>
     </QBXMLMsgsRq>
   </QBXML>

7. Web Connector executes in QuickBooks
8. receiveResponseXML() gets response with TxnID
9. Server updates:
   - qb_sync_queue.status = 'completed'
   - qb_bill_map: insert mapping
   - v2_invoices.qb_synced = true
   - v2_invoices.qb_txn_id = TxnID
```

### Flow 2: Bill Paid in QB → Update Invoice

```
1. Periodic sync job runs (or triggered by Web Connector)
2. sendRequestXML() returns BillPaymentCheckQueryRq:

   <?xml version="1.0"?>
   <?qbxml version="13.0"?>
   <QBXML>
     <QBXMLMsgsRq onError="continueOnError">
       <BillPaymentCheckQueryRq>
         <ModifiedDateRangeFilter>
           <FromModifiedDate>2026-01-07</FromModifiedDate>
         </ModifiedDateRangeFilter>
       </BillPaymentCheckQueryRq>
     </QBXMLMsgsRq>
   </QBXML>

3. Response contains paid bills with TxnIDs
4. Server matches TxnIDs to qb_bill_map
5. For each matched invoice:
   - v2_invoices.paid_to_vendor = true
   - v2_invoices.paid_to_vendor_date = payment.date
   - v2_invoices.paid_to_vendor_amount = payment.amount
   - v2_invoices.paid_to_vendor_ref = payment.check_number
   - qb_bill_map.is_paid = true
```

### Flow 3: Vendor Sync

```
1. Initial setup or periodic sync
2. Query all vendors from QuickBooks
3. Match by name to v2_vendors
4. Create qb_vendor_map entries
5. For unmatched vendors:
   - Option A: Create in QuickBooks
   - Option B: Flag for manual mapping
```

---

## Web Connector Setup

### QWC File Template
**File:** `quickbooks/ross-built.qwc`

```xml
<?xml version="1.0"?>
<QBWCXML>
  <AppName>Ross Built Invoice System</AppName>
  <AppID></AppID>
  <AppURL>https://your-server.com/qbwc/soap</AppURL>
  <AppDescription>Syncs invoices and bills between Ross Built and QuickBooks</AppDescription>
  <AppSupport>https://your-server.com/support</AppSupport>
  <UserName>RossBuiltSync</UserName>
  <OwnerID>{YOUR-GUID-HERE}</OwnerID>
  <FileID>{YOUR-GUID-HERE}</FileID>
  <QBType>QBFS</QBType>
  <Scheduler>
    <RunEveryNMinutes>15</RunEveryNMinutes>
  </Scheduler>
  <IsReadOnly>false</IsReadOnly>
</QBWCXML>
```

### Installation Steps
1. Generate unique GUIDs for OwnerID and FileID
2. Host QWC file on server
3. User downloads and opens QWC file
4. Web Connector prompts to add application
5. User enters password (configured in your system)
6. Web Connector starts polling

---

## API Endpoints

### Admin Endpoints

```
GET  /api/quickbooks/status         - Connection status, last sync time
POST /api/quickbooks/sync/vendors   - Trigger vendor sync
POST /api/quickbooks/sync/payments  - Trigger payment sync
GET  /api/quickbooks/queue          - View pending sync items
POST /api/quickbooks/retry/:id      - Retry failed item
GET  /api/quickbooks/mappings       - View vendor/bill mappings
POST /api/quickbooks/map-vendor     - Manually map vendor
```

### QBWC SOAP Endpoint

```
POST /qbwc/soap                     - Web Connector SOAP endpoint
GET  /qbwc/ross-built.qwc          - Download QWC file
```

---

## UI Changes

### Invoice Modal
- Add "Paid to Vendor" indicator (checkbox or badge)
- Show payment date and reference if paid
- Show QB sync status icon

### Invoice List
- Add filter: "Paid to Vendor" / "Unpaid to Vendor"
- Add column or badge showing payment status

### Settings Page (New)
- QuickBooks connection status
- Last sync timestamp
- Manual sync buttons
- Vendor mapping interface
- Sync error log

---

## Error Handling

### Common QB Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| 3100 | Vendor not found | Trigger vendor sync |
| 3120 | Duplicate RefNumber | Append suffix or skip |
| 3140 | Account not found | Map cost codes to QB accounts |
| 500 | QB not open | Alert user, retry later |

### Retry Strategy
- Attempt 1: Immediate
- Attempt 2: 5 minutes
- Attempt 3: 30 minutes
- Attempt 4: 2 hours
- After 4 failures: Mark as failed, alert admin

---

## Security Considerations

1. **HTTPS Required** - QBWC requires SSL for production
2. **Password Storage** - Hash QBWC password, never log
3. **Session Tickets** - Short-lived, rotate frequently
4. **IP Whitelist** - Optional, restrict to office IP
5. **Audit Log** - Log all QB operations

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Database schema changes
- [ ] Add "Paid to Vendor" fields to invoice
- [ ] UI for manual "Mark as Paid"
- [ ] Basic vendor mapping table

### Phase 2: QBWC Server (Week 2)
- [ ] SOAP endpoint structure
- [ ] Authentication flow
- [ ] Session management
- [ ] Basic request/response handling

### Phase 3: Bill Sync (Week 3)
- [ ] qbXML builder for BillAdd
- [ ] Queue system for pending operations
- [ ] Hook into invoice approval flow
- [ ] Response parsing and mapping

### Phase 4: Payment Sync (Week 4)
- [ ] qbXML queries for bill payments
- [ ] Payment status updates
- [ ] Periodic sync job

### Phase 5: Polish (Week 5)
- [ ] Admin UI for mappings and status
- [ ] Error handling and retry logic
- [ ] Vendor sync
- [ ] Testing with real QuickBooks

---

## Dependencies

```json
{
  "soap": "^1.0.0",           // SOAP server
  "xml2js": "^0.6.0",         // XML parsing
  "xmlbuilder2": "^3.0.0",    // XML building
  "uuid": "^9.0.0"            // GUID generation
}
```

---

## Testing

### Without QuickBooks
- Mock QBWC responses
- Test queue processing
- Test error handling

### With QuickBooks
- Use QuickBooks SDK sample company
- Test full sync flow
- Verify bill creation
- Verify payment sync

---

## References

- [QuickBooks Web Connector Programmer's Guide](https://developer.intuit.com/app/developer/qbdesktop/docs/develop/qbwc-programmer-guide)
- [qbXML Reference](https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop)
- [QBWC SOAP Specification](https://developer.intuit.com/app/developer/qbdesktop/docs/develop/qbwc-soap-spec)
