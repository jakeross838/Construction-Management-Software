import { useState, useCallback } from 'react';
import { 
  Estimate, 
  EstimateSection, 
  EstimateGroup,
  EstimateSubgroup,
  EstimateLineItem, 
  EstimateMarkupSettings,
  defaultMarkupSettings,
  calculateMarkup,
  generateEstimateNumber,
  generateId,
} from '@/types/estimate';
import { estimates as mockEstimates } from '@/data/mockEstimates';

// Migrate old flat structure to new hierarchical structure
function migrateSection(section: EstimateSection): EstimateSection {
  // If section already has groups, return as-is
  if (section.groups && section.groups.length > 0) {
    return section;
  }

  // Migrate legacy lineItems to new structure
  const legacyItems = section.lineItems || [];
  if (legacyItems.length === 0) {
    return { ...section, groups: [] };
  }

  // Create a default group and subgroup for legacy items
  const defaultSubgroup: EstimateSubgroup = {
    id: generateId('sub'),
    name: 'General',
    lineItems: legacyItems,
    subtotal: section.subtotal,
    subtotalWithMarkup: section.subtotalWithMarkup,
    sortOrder: 1,
  };

  const defaultGroup: EstimateGroup = {
    id: generateId('grp'),
    name: 'General',
    subgroups: [defaultSubgroup],
    subtotal: section.subtotal,
    subtotalWithMarkup: section.subtotalWithMarkup,
    sortOrder: 1,
  };

  return {
    ...section,
    groups: [defaultGroup],
    lineItems: undefined, // Clear legacy field
  };
}

export interface UseEstimatesReturn {
  estimates: Estimate[];
  createEstimate: (data: Partial<Estimate>) => Estimate;
  updateEstimate: (id: string, data: Partial<Estimate>) => void;
  deleteEstimate: (id: string) => void;
  duplicateEstimate: (id: string) => Estimate;
  recalculateTotals: (estimate: Estimate) => Estimate;
  getEstimateById: (id: string) => Estimate | undefined;
}

export function useEstimates(): UseEstimatesReturn {
  // Migrate mock data on initial load
  const migratedMockEstimates = mockEstimates.map(est => ({
    ...est,
    sections: est.sections.map(migrateSection),
  }));

  const [estimates, setEstimates] = useState<Estimate[]>(migratedMockEstimates);

  const recalculateTotals = useCallback((estimate: Estimate): Estimate => {
    let subtotalMaterial = 0;
    let subtotalLabor = 0;
    let subtotalSubcontractor = 0;
    let subtotalEquipment = 0;
    let subtotalOther = 0;

    const updatedSections = estimate.sections.map(section => {
      const updatedGroups = section.groups.map(group => {
        const updatedSubgroups = group.subgroups.map(subgroup => {
          let subgroupSubtotal = 0;
          let subgroupSubtotalWithMarkup = 0;

          const updatedLineItems = subgroup.lineItems.map(item => {
            const totalCost = item.quantity * item.unitCost;
            const markupAmount = calculateMarkup(totalCost, item.markup, item.markupType);
            const totalWithMarkup = totalCost + markupAmount;

            // Accumulate by type
            switch (item.type) {
              case 'material': subtotalMaterial += totalCost; break;
              case 'labor': subtotalLabor += totalCost; break;
              case 'subcontractor': subtotalSubcontractor += totalCost; break;
              case 'equipment': subtotalEquipment += totalCost; break;
              case 'other': subtotalOther += totalCost; break;
            }

            subgroupSubtotal += totalCost;
            subgroupSubtotalWithMarkup += totalWithMarkup;

            return { ...item, totalCost, totalWithMarkup };
          });

          return {
            ...subgroup,
            lineItems: updatedLineItems,
            subtotal: subgroupSubtotal,
            subtotalWithMarkup: subgroupSubtotalWithMarkup,
          };
        });

        const groupSubtotal = updatedSubgroups.reduce((sum, sg) => sum + sg.subtotal, 0);
        const groupSubtotalWithMarkup = updatedSubgroups.reduce((sum, sg) => sum + sg.subtotalWithMarkup, 0);

        return {
          ...group,
          subgroups: updatedSubgroups,
          subtotal: groupSubtotal,
          subtotalWithMarkup: groupSubtotalWithMarkup,
        };
      });

      const sectionSubtotal = updatedGroups.reduce((sum, g) => sum + g.subtotal, 0);
      const sectionSubtotalWithMarkup = updatedGroups.reduce((sum, g) => sum + g.subtotalWithMarkup, 0);

      return {
        ...section,
        groups: updatedGroups,
        subtotal: sectionSubtotal,
        subtotalWithMarkup: sectionSubtotalWithMarkup,
      };
    });

    const subtotalDirect = subtotalMaterial + subtotalLabor + subtotalSubcontractor + subtotalEquipment + subtotalOther;
    
    // Calculate with markups applied
    const totalWithTypeMarkups = updatedSections.reduce((sum, s) => sum + s.subtotalWithMarkup, 0);
    
    const overheadAmount = totalWithTypeMarkups * (estimate.markupSettings.overheadPercent / 100);
    const profitAmount = (totalWithTypeMarkups + overheadAmount) * (estimate.markupSettings.profitPercent / 100);
    const totalBeforeContingency = totalWithTypeMarkups + overheadAmount + profitAmount;
    const contingencyAmount = totalBeforeContingency * (estimate.markupSettings.contingencyPercent / 100);
    const totalAmount = totalBeforeContingency + contingencyAmount;

    const totalAllowances = estimate.allowances.reduce((sum, a) => sum + a.amount, 0);

    return {
      ...estimate,
      sections: updatedSections,
      subtotalMaterial,
      subtotalLabor,
      subtotalSubcontractor,
      subtotalEquipment,
      subtotalOther,
      subtotalDirect,
      overheadAmount,
      profitAmount,
      contingencyAmount,
      totalBeforeContingency,
      totalAmount,
      totalAllowances,
      updatedAt: new Date().toISOString().split('T')[0],
    };
  }, []);

  const createEstimate = useCallback((data: Partial<Estimate>): Estimate => {
    const newEstimate: Estimate = {
      id: generateId('est'),
      number: generateEstimateNumber(estimates.length + 1),
      version: 1,
      jobId: data.jobId,
      clientName: data.clientName || '',
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone,
      clientAddress: data.clientAddress,
      projectName: data.projectName || '',
      projectAddress: data.projectAddress,
      projectDescription: data.projectDescription || '',
      projectSquareFeet: data.projectSquareFeet,
      projectType: data.projectType || 'new_construction',
      status: 'draft',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      sections: data.sections?.map(migrateSection) || [],
      subtotalMaterial: 0,
      subtotalLabor: 0,
      subtotalSubcontractor: 0,
      subtotalEquipment: 0,
      subtotalOther: 0,
      subtotalDirect: 0,
      markupSettings: data.markupSettings || { ...defaultMarkupSettings },
      overheadAmount: 0,
      profitAmount: 0,
      contingencyAmount: 0,
      totalBeforeContingency: 0,
      totalAmount: 0,
      allowances: data.allowances || [],
      totalAllowances: 0,
      exclusions: data.exclusions || [],
      clarifications: data.clarifications || [],
      termsAndConditions: data.termsAndConditions,
      createdBy: 'current-user',
      assignedTo: data.assignedTo,
      leadId: data.leadId,
      notes: data.notes,
    };

    const calculated = recalculateTotals(newEstimate);
    setEstimates(prev => [...prev, calculated]);
    return calculated;
  }, [estimates.length, recalculateTotals]);

  const updateEstimate = useCallback((id: string, data: Partial<Estimate>) => {
    setEstimates(prev => prev.map(est => {
      if (est.id !== id) return est;
      const updated = { ...est, ...data, updatedAt: new Date().toISOString().split('T')[0] };
      return recalculateTotals(updated);
    }));
  }, [recalculateTotals]);

  const deleteEstimate = useCallback((id: string) => {
    setEstimates(prev => prev.filter(e => e.id !== id));
  }, []);

  const duplicateEstimate = useCallback((id: string): Estimate => {
    const original = estimates.find(e => e.id === id);
    if (!original) throw new Error('Estimate not found');

    const duplicateSubgroup = (sg: EstimateSubgroup): EstimateSubgroup => ({
      ...sg,
      id: generateId('sub'),
      lineItems: sg.lineItems.map(li => ({ ...li, id: generateId('li') })),
    });

    const duplicateGroup = (g: EstimateGroup): EstimateGroup => ({
      ...g,
      id: generateId('grp'),
      subgroups: g.subgroups.map(duplicateSubgroup),
    });

    const duplicated: Estimate = {
      ...original,
      id: generateId('est'),
      number: generateEstimateNumber(estimates.length + 1),
      version: 1,
      status: 'draft',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      sentAt: undefined,
      expiresAt: undefined,
      approvedAt: undefined,
      convertedToJobId: undefined,
      sections: original.sections.map(s => ({
        ...s,
        id: generateId('sec'),
        groups: s.groups.map(duplicateGroup),
      })),
      allowances: original.allowances.map(a => ({ ...a, id: generateId('allow') })),
    };

    setEstimates(prev => [...prev, duplicated]);
    return duplicated;
  }, [estimates]);

  const getEstimateById = useCallback((id: string) => {
    return estimates.find(e => e.id === id);
  }, [estimates]);

  return {
    estimates,
    createEstimate,
    updateEstimate,
    deleteEstimate,
    duplicateEstimate,
    recalculateTotals,
    getEstimateById,
  };
}
