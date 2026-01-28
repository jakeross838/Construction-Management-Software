import { useState, useCallback } from 'react';
import { LeadFull, mockLeads as initialLeads, getNextStage } from '@/data/mockLeads';
import { LeadStage } from '@/types/job';
import { toast } from 'sonner';

export function useLeads() {
  const [leads, setLeads] = useState<LeadFull[]>(initialLeads);

  const addLead = useCallback((lead: Omit<LeadFull, 'id' | 'createdAt' | 'updatedAt' | 'daysInStage'>) => {
    const newLead: LeadFull = {
      ...lead,
      id: `lead-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      daysInStage: 0,
    };
    setLeads(prev => [newLead, ...prev]);
    toast.success(`Lead "${lead.name}" created successfully`);
    return newLead;
  }, []);

  const updateLead = useCallback((id: string, updates: Partial<LeadFull>) => {
    setLeads(prev => prev.map(lead => 
      lead.id === id 
        ? { ...lead, ...updates, updatedAt: new Date().toISOString().split('T')[0] }
        : lead
    ));
    toast.success('Lead updated successfully');
  }, []);

  const deleteLead = useCallback((id: string) => {
    setLeads(prev => prev.filter(lead => lead.id !== id));
    toast.success('Lead deleted');
  }, []);

  const moveToStage = useCallback((id: string, newStage: LeadStage) => {
    setLeads(prev => prev.map(lead =>
      lead.id === id
        ? { ...lead, stage: newStage, daysInStage: 0, updatedAt: new Date().toISOString().split('T')[0] }
        : lead
    ));
    toast.success(`Lead moved to ${newStage.replace('_', ' ')}`);
  }, []);

  const moveToNextStage = useCallback((id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    
    const nextStage = getNextStage(lead.stage);
    if (nextStage) {
      moveToStage(id, nextStage);
    }
  }, [leads, moveToStage]);

  const markAsLost = useCallback((id: string) => {
    moveToStage(id, 'lost');
  }, [moveToStage]);

  const markAsWon = useCallback((id: string) => {
    moveToStage(id, 'won');
  }, [moveToStage]);

  return {
    leads,
    addLead,
    updateLead,
    deleteLead,
    moveToStage,
    moveToNextStage,
    markAsLost,
    markAsWon,
  };
}
