require('dotenv').config();

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = 'sorghqcpeamdfbvysafj';

async function runSQL(sql, description) {
  console.log(`${description}...`);

  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error (${response.status}): ${text}`);
  }

  return response.json();
}

async function seedData() {
  console.log('Seeding contract clauses and variable sources...\n');

  // Seed default clauses
  await runSQL(`
    INSERT INTO v2_contract_clauses (name, description, category, content, is_required, sort_order, created_by)
    VALUES
    ('Indemnification', 'Standard indemnification clause', 'legal',
     'CONTRACTOR agrees to indemnify, defend, and hold harmless OWNER, and OWNER''s officers, directors, employees, and agents from and against all claims, damages, losses, and expenses, including but not limited to attorneys'' fees, arising out of or resulting from the performance of the Work, provided that any such claim, damage, loss, or expense is attributable to bodily injury, sickness, disease, or death, or to injury to or destruction of tangible property, including loss of use resulting therefrom, to the extent caused by any negligent act or omission of CONTRACTOR, any subcontractor, anyone directly or indirectly employed by any of them, or anyone for whose acts any of them may be liable.',
     true, 10, 'System'),

    ('Limitation of Liability', 'Caps liability amounts', 'legal',
     'Notwithstanding any other provision of this Agreement, CONTRACTOR''s total liability to OWNER for any and all claims arising out of or related to this Agreement shall not exceed the total Contract Price. In no event shall either party be liable to the other for any indirect, special, incidental, consequential, or punitive damages, including but not limited to loss of profits, loss of revenue, or loss of use, regardless of whether such party knew or should have known of the possibility of such damages.',
     false, 20, 'System'),

    ('Right to Stop Work', 'Payment default clause', 'payment',
     'If OWNER fails to make any payment to CONTRACTOR within {{PAYMENT_TERMS_DAYS}} days after the date such payment is due, CONTRACTOR may, upon seven (7) days'' written notice to OWNER, stop the Work until payment of the amount owing has been received. The Contract Time shall be extended appropriately, and the Contract Price shall be increased by the amount of CONTRACTOR''s reasonable costs of shutdown, delay, and start-up.',
     true, 30, 'System'),

    ('Change Order Process', 'Process for changes to scope', 'scope',
     'No changes to the Work shall be made except by written Change Order signed by both OWNER and CONTRACTOR. Change Orders for work costing less than {{CHANGE_ORDER_THRESHOLD}} shall be marked up at {{CHANGE_ORDER_MARKUP_PERCENT}}% for overhead and profit. Change Orders for work costing {{CHANGE_ORDER_THRESHOLD}} or more shall be marked up at {{CHANGE_ORDER_MARKUP_PERCENT_LARGE}}% for overhead and profit. CONTRACTOR shall submit itemized cost breakdowns for all Change Orders.',
     true, 40, 'System'),

    ('Retainage', 'Payment retainage terms', 'payment',
     'OWNER shall retain {{RETAINAGE_PERCENT}}% of each progress payment as retainage. Upon Substantial Completion of the Work, retainage shall be reduced to {{RETAINAGE_RELEASE_PERCENT}}%. Final retainage shall be released within thirty (30) days after Final Completion and acceptance of the Work, subject to receipt of all required closeout documents, lien releases, and warranties.',
     true, 50, 'System'),

    ('Insurance Requirements', 'Required insurance coverage', 'insurance',
     'CONTRACTOR shall maintain the following insurance coverage throughout the duration of this Agreement: (a) Commercial General Liability Insurance with limits of not less than $1,000,000 per occurrence and $2,000,000 aggregate; (b) Automobile Liability Insurance with limits of not less than $1,000,000 combined single limit; (c) Workers'' Compensation Insurance as required by law; and (d) Umbrella/Excess Liability Insurance with limits of not less than $2,000,000. CONTRACTOR shall name OWNER as an additional insured on all policies except Workers'' Compensation.',
     true, 60, 'System'),

    ('Warranty', 'Workmanship warranty clause', 'warranty',
     'CONTRACTOR warrants to OWNER that all Work will be free from defects in materials and workmanship for a period of one (1) year from the date of Substantial Completion. CONTRACTOR shall promptly correct any Work found to be defective within the warranty period at no additional cost to OWNER. This warranty is in addition to, and not in lieu of, any other warranties provided by manufacturers or suppliers.',
     true, 70, 'System'),

    ('Dispute Resolution', 'Mediation and arbitration clause', 'dispute',
     'Any dispute arising out of or relating to this Agreement shall first be submitted to mediation before a mutually agreed-upon mediator. If mediation is unsuccessful, the dispute shall be resolved by binding arbitration in accordance with the Construction Industry Arbitration Rules of the American Arbitration Association. The arbitration shall take place in {{PROJECT_COUNTY}}, Florida. Judgment upon the award may be entered in any court having jurisdiction.',
     false, 80, 'System'),

    ('Termination for Convenience', 'Owner termination rights', 'termination',
     'OWNER may terminate this Agreement for convenience upon fourteen (14) days'' written notice to CONTRACTOR. In the event of such termination, CONTRACTOR shall be entitled to payment for Work properly performed prior to termination, plus reasonable demobilization costs, but shall not be entitled to any anticipated profit on Work not performed.',
     false, 90, 'System'),

    ('Florida Lien Law Notice', 'Required Florida disclosure', 'florida',
     'FLORIDA LIEN LAW DISCLOSURE: According to Florida''s Construction Lien Law (Chapter 713, Florida Statutes), those who work on your property or provide materials and services and are not paid in full have a right to enforce their claim for payment against your property. This claim is known as a construction lien. If your contractor or a subcontractor fails to pay subcontractors, sub-subcontractors, or material suppliers, those people who are owed money may look to your property for payment, even if you have already paid your contractor in full.',
     true, 100, 'System')
    ON CONFLICT DO NOTHING;
  `, 'Seeding default clauses');

  // Seed variable sources
  await runSQL(`
    INSERT INTO v2_contract_variable_sources (variable_name, display_label, description, source_type, source_table, source_field, format_type, is_required, default_value, is_system)
    VALUES
    ('OWNER_NAME', 'Owner Name', 'Name of the property owner', 'contact', 'v2_contacts', 'full_name', null, true, null, true),
    ('OWNER_ADDRESS', 'Owner Address', 'Address of the property owner', 'contact', 'v2_contacts', 'address', null, false, null, true),
    ('OWNER_EMAIL', 'Owner Email', 'Email of the property owner', 'contact', 'v2_contacts', 'email', null, false, null, true),
    ('OWNER_PHONE', 'Owner Phone', 'Phone number of the property owner', 'contact', 'v2_contacts', 'phone', 'phone', false, null, true),
    ('PROJECT_NAME', 'Project Name', 'Name of the project', 'job', 'v2_jobs', 'name', null, true, null, true),
    ('PROJECT_ADDRESS', 'Project Address', 'Address of the project', 'job', 'v2_jobs', 'address', null, true, null, true),
    ('PROJECT_CITY', 'Project City', 'City where the project is located', 'job', 'v2_jobs', 'city', null, false, null, true),
    ('PROJECT_STATE', 'Project State', 'State where the project is located', 'job', 'v2_jobs', 'state', null, false, 'Florida', true),
    ('PROJECT_COUNTY', 'Project County', 'County where the project is located', 'job', 'v2_jobs', 'county', null, false, null, true),
    ('PROJECT_DESCRIPTION', 'Project Description', 'Description of the project scope', 'job', 'v2_jobs', 'description', null, false, null, true),
    ('CONTRACT_AMOUNT', 'Contract Amount', 'Total contract price', 'contract', 'v2_contracts', 'contract_amount', 'currency', true, null, true),
    ('CONTRACT_NUMBER', 'Contract Number', 'Unique contract identifier', 'contract', 'v2_contracts', 'contract_number', null, true, null, true),
    ('START_DATE', 'Start Date', 'Contract start date', 'contract', 'v2_contracts', 'start_date', 'date', false, null, true),
    ('END_DATE', 'End Date', 'Contract end date', 'contract', 'v2_contracts', 'end_date', 'date', false, null, true),
    ('DURATION_MONTHS', 'Duration (Months)', 'Project duration in months', 'manual', null, null, null, false, '12', true),
    ('RETAINAGE_PERCENT', 'Retainage Percent', 'Percentage retained from payments', 'manual', null, null, 'percentage', false, '10', true),
    ('RETAINAGE_RELEASE_PERCENT', 'Retainage Release Percent', 'Percentage after substantial completion', 'manual', null, null, 'percentage', false, '5', true),
    ('PAYMENT_TERMS_DAYS', 'Payment Terms (Days)', 'Days for payment after invoice', 'manual', null, null, null, false, '10', true),
    ('CHANGE_ORDER_MARKUP_PERCENT', 'Change Order Markup %', 'Markup percentage for small changes', 'manual', null, null, 'percentage', false, '15', true),
    ('CHANGE_ORDER_MARKUP_PERCENT_LARGE', 'Large CO Markup %', 'Markup percentage for large changes', 'manual', null, null, 'percentage', false, '10', true),
    ('CHANGE_ORDER_THRESHOLD', 'Change Order Threshold', 'Dollar threshold for markup tiers', 'manual', null, null, 'currency', false, '10000', true),
    ('BUILDER_FEE_PERCENT', 'Builder Fee Percent', 'Builder fee as percentage of cost', 'manual', null, null, 'percentage', false, '15', true),
    ('GMP_AMOUNT', 'Guaranteed Maximum Price', 'Maximum contract price if applicable', 'manual', null, null, 'currency', false, null, true),
    ('SUPERVISION_MONTHLY_RATE', 'Supervision Rate', 'Monthly supervision fee', 'manual', null, null, 'currency', false, '15000', true),
    ('CURRENT_DATE', 'Current Date', 'Today''s date', 'system', null, null, 'date', false, null, true),
    ('CURRENT_YEAR', 'Current Year', 'Current year', 'system', null, null, null, false, null, true),
    ('BUILDER_NAME', 'Builder/Contractor Name', 'Name of the builder', 'company', 'v2_companies', 'name', null, true, 'Ross Built Construction, LLC', true),
    ('BUILDER_ADDRESS', 'Builder Address', 'Address of the builder', 'company', 'v2_companies', 'address', null, false, null, true),
    ('BUILDER_LICENSE', 'Builder License Number', 'Contractor license number', 'manual', null, null, null, false, null, true)
    ON CONFLICT (variable_name) DO UPDATE SET
      display_label = EXCLUDED.display_label,
      description = EXCLUDED.description,
      source_type = EXCLUDED.source_type,
      source_table = EXCLUDED.source_table,
      source_field = EXCLUDED.source_field,
      format_type = EXCLUDED.format_type,
      is_required = EXCLUDED.is_required,
      default_value = EXCLUDED.default_value;
  `, 'Seeding variable sources');

  // Seed a default prime contract template
  await runSQL(`
    INSERT INTO v2_contract_templates (name, description, template_type, content, variables, is_default, requires_florida_lien_disclosure, created_by)
    VALUES (
      'Cost Plus Fixed Fee Contract',
      'Standard cost-plus contract with fixed builder fee for residential construction',
      'prime_contract',
      'CONSTRUCTION AGREEMENT

COST PLUS FIXED FEE CONTRACT

This Construction Agreement ("Agreement") is made and entered into as of {{CURRENT_DATE}} by and between:

OWNER:
{{OWNER_NAME}}
{{OWNER_ADDRESS}}

CONTRACTOR:
{{BUILDER_NAME}}
{{BUILDER_ADDRESS}}
License No.: {{BUILDER_LICENSE}}

PROJECT:
{{PROJECT_NAME}}
{{PROJECT_ADDRESS}}
{{PROJECT_CITY}}, {{PROJECT_STATE}}

ARTICLE 1 - SCOPE OF WORK

CONTRACTOR agrees to furnish all labor, materials, equipment, and services necessary for the construction of the above-referenced Project in accordance with the Plans and Specifications attached hereto as Exhibit A.

{{PROJECT_DESCRIPTION}}

ARTICLE 2 - CONTRACT PRICE

This is a Cost Plus Fixed Fee contract. OWNER agrees to pay CONTRACTOR:

a) The actual Cost of the Work as defined herein
b) A fixed Builder''s Fee of {{BUILDER_FEE_PERCENT}}% of the Cost of the Work
c) Monthly supervision fee of {{SUPERVISION_MONTHLY_RATE}}

The Guaranteed Maximum Price (GMP), if applicable: {{GMP_AMOUNT}}

ARTICLE 3 - PAYMENT TERMS

Progress payments shall be made on a {{DRAW_FREQUENCY}} basis. OWNER shall pay each invoice within {{PAYMENT_TERMS_DAYS}} days of receipt. OWNER shall retain {{RETAINAGE_PERCENT}}% of each payment as retainage.

ARTICLE 4 - PROJECT DURATION

The Project is estimated to be completed within {{DURATION_MONTHS}} months from the date of commencement, subject to delays beyond CONTRACTOR''s control.

ARTICLE 5 - CHANGE ORDERS

Changes to the scope of work require a written Change Order signed by both parties. Change Orders shall be priced as follows:
- Changes under {{CHANGE_ORDER_THRESHOLD}}: Cost + {{CHANGE_ORDER_MARKUP_PERCENT}}% markup
- Changes {{CHANGE_ORDER_THRESHOLD}} or more: Cost + {{CHANGE_ORDER_MARKUP_PERCENT_LARGE}}% markup

ARTICLE 6 - WARRANTIES

CONTRACTOR warrants all work for a period of one (1) year from Substantial Completion.

ARTICLE 7 - INSURANCE

CONTRACTOR shall maintain general liability, auto, and workers'' compensation insurance as required by law.

ARTICLE 8 - DISPUTE RESOLUTION

Disputes shall be resolved through mediation, then binding arbitration in {{PROJECT_COUNTY}}, Florida.

ARTICLE 9 - FLORIDA CONSTRUCTION LIEN LAW

{{FLORIDA_LIEN_DISCLOSURE}}

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.


OWNER: _________________________
       {{OWNER_NAME}}
       Date: _______________


CONTRACTOR: _________________________
            {{BUILDER_NAME}}
            Date: _______________',
      '["CURRENT_DATE", "OWNER_NAME", "OWNER_ADDRESS", "BUILDER_NAME", "BUILDER_ADDRESS", "BUILDER_LICENSE", "PROJECT_NAME", "PROJECT_ADDRESS", "PROJECT_CITY", "PROJECT_STATE", "PROJECT_DESCRIPTION", "BUILDER_FEE_PERCENT", "SUPERVISION_MONTHLY_RATE", "GMP_AMOUNT", "DRAW_FREQUENCY", "PAYMENT_TERMS_DAYS", "RETAINAGE_PERCENT", "DURATION_MONTHS", "CHANGE_ORDER_THRESHOLD", "CHANGE_ORDER_MARKUP_PERCENT", "CHANGE_ORDER_MARKUP_PERCENT_LARGE", "PROJECT_COUNTY", "FLORIDA_LIEN_DISCLOSURE"]'::jsonb,
      true,
      true,
      'System'
    )
    ON CONFLICT DO NOTHING;
  `, 'Seeding default contract template');

  console.log('\n✅ All seed data inserted successfully!');
}

seedData().catch(err => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
