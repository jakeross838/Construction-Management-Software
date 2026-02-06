const fs = require('fs');
const path = './client/src/pages/Contracts.tsx';

let content = fs.readFileSync(path, 'utf8');

// Check if already updated
if (content.includes('ContractBuilder')) {
  console.log('ContractBuilder already imported');
  process.exit(0);
}

// Add import for ContractBuilder
content = content.replace(
  "import { useContracts, useContractStats, Contract } from '@/hooks/useContracts';",
  `import { useContracts, useContractStats, Contract } from '@/hooks/useContracts';
import { ContractBuilder } from '@/components/contracts/ContractBuilder';`
);

// Add state for showing builder
content = content.replace(
  'const [selectedContract, setSelectedContract] = useState<Contract | null>(null);',
  `const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);`
);

// Update the New Contract button to open the builder
content = content.replace(
  `<Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Contract
          </Button>`,
  `<Button className="gap-2" onClick={() => setShowBuilder(true)}>
            <Plus className="h-4 w-4" />
            New Contract
          </Button>`
);

// Add the Contract Builder dialog before the existing contract detail dialog
const dialogPosition = content.indexOf('{/* Contract Detail Dialog */}');
if (dialogPosition !== -1) {
  const builderDialog = `{/* Contract Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Contract</DialogTitle>
          </DialogHeader>
          <ContractBuilder
            jobId={selectedJobId || undefined}
            onSave={(contractId) => {
              setShowBuilder(false);
              // Optionally navigate to the new contract or refresh the list
            }}
            onCancel={() => setShowBuilder(false)}
          />
        </DialogContent>
      </Dialog>

      `;
  content = content.slice(0, dialogPosition) + builderDialog + content.slice(dialogPosition);
}

fs.writeFileSync(path, content);
console.log('Contracts page updated with ContractBuilder');
