const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// Add the require statement
if (!content.includes("require('./routes/contract-templates')")) {
  content = content.replace(
    "const contractsRoutes = require('./routes/contracts');",
    "const contractsRoutes = require('./routes/contracts');\nconst contractTemplatesRoutes = require('./routes/contract-templates');"
  );
}

// Add the app.use statement
if (!content.includes("app.use('/api/contract-templates'")) {
  content = content.replace(
    "app.use('/api/contracts', contractsRoutes);",
    "app.use('/api/contracts', contractsRoutes);\napp.use('/api/contract-templates', contractTemplatesRoutes);"
  );
}

fs.writeFileSync(indexPath, content);
console.log('Routes added successfully!');
