/**
 * OpenAPI/Swagger Configuration
 * API Documentation for Ross Built CMS
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ross Built CMS API',
      version: '2.0.0',
      description: 'Construction Management Software API for Ross Built Custom Homes',
      contact: {
        name: 'Ross Built Custom Homes'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    tags: [
      { name: 'Invoices', description: 'Invoice management endpoints' },
      { name: 'Purchase Orders', description: 'PO management endpoints' },
      { name: 'Draws', description: 'Draw/Pay Application management' },
      { name: 'Jobs', description: 'Job/Project management' },
      { name: 'Vendors', description: 'Vendor management' },
      { name: 'AI', description: 'AI processing endpoints' },
      { name: 'Health', description: 'System health endpoints' }
    ],
    components: {
      schemas: {
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            job_id: { type: 'string', format: 'uuid', nullable: true },
            vendor_id: { type: 'string', format: 'uuid', nullable: true },
            po_id: { type: 'string', format: 'uuid', nullable: true },
            invoice_number: { type: 'string' },
            invoice_date: { type: 'string', format: 'date' },
            due_date: { type: 'string', format: 'date', nullable: true },
            amount: { type: 'number' },
            status: {
              type: 'string',
              enum: ['needs_review', 'ready_for_approval', 'approved', 'in_draw', 'billed', 'paid', 'denied', 'split']
            },
            pdf_url: { type: 'string', nullable: true },
            pdf_stamped_url: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        PurchaseOrder: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            job_id: { type: 'string', format: 'uuid' },
            vendor_id: { type: 'string', format: 'uuid' },
            po_number: { type: 'string' },
            description: { type: 'string', nullable: true },
            total_amount: { type: 'number' },
            status: {
              type: 'string',
              enum: ['draft', 'open', 'closed', 'cancelled']
            },
            approval_status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected']
            },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Draw: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            job_id: { type: 'string', format: 'uuid' },
            draw_number: { type: 'integer' },
            period_end: { type: 'string', format: 'date' },
            total_amount: { type: 'number' },
            status: {
              type: 'string',
              enum: ['draft', 'submitted', 'funded']
            },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Job: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            address: { type: 'string', nullable: true },
            client_name: { type: 'string', nullable: true },
            contract_amount: { type: 'number', nullable: true },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'on_hold']
            },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Vendor: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            trade: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Allocation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoice_id: { type: 'string', format: 'uuid' },
            job_id: { type: 'string', format: 'uuid' },
            cost_code_id: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            notes: { type: 'string', nullable: true }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            code: { type: 'string' },
            details: { type: 'object' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' }
          }
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            memory: { type: 'object' },
            checks: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    responseTime: { type: 'number' }
                  }
                },
                storage: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    responseTime: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      },
      parameters: {
        idParam: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Resource UUID'
        },
        pageParam: {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', default: 1 },
          description: 'Page number for pagination'
        },
        limitParam: {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', default: 50 },
          description: 'Items per page'
        }
      }
    }
  },
  apis: ['./server/routes/*.js', './server/index.js']
};

const specs = swaggerJsdoc(options);

/**
 * Setup Swagger UI middleware
 * @param {Express} app - Express application
 */
function setupSwagger(app) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Ross Built CMS API Docs'
  }));

  // JSON endpoint for the OpenAPI spec
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
}

module.exports = { setupSwagger, specs };
