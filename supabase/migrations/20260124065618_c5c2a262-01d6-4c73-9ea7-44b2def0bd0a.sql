-- Create expenses table for company-wide overhead tracking
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('labor-burden', 'fleet', 'office', 'professional', 'tools', 'insurance', 'marketing')),
  name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annual')),
  vendor_id UUID REFERENCES public.vendors(id),
  payment_date DATE,
  next_due_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create policies (public access for now since no auth)
CREATE POLICY "Allow all operations on expenses"
ON public.expenses
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();