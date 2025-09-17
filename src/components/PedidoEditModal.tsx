import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { RotateCcw, X } from 'lucide-react';

interface Pedido {
  id: string;
  pedido_externo: string | null;
  pedido_interno: number;
  data_externa: string | null;
  data_interna: string | null;
  cliente_fantasia: string | null;
  vendedor_nome: string | null;
  data_faturamento: string | null;
  dt_envio_pos_venda: string | null;
  dt_envio_cliente: string | null;
  codigo_rastreio: string | null;
}

interface PedidoEditModalProps {
  pedido: Pedido | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (updatedPedido: Pedido) => void;
}

const PedidoEditModal = ({ pedido, open, onClose, onUpdate }: PedidoEditModalProps) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Pedido>>({});

  useEffect(() => {
    if (pedido) {
      setFormData({
        data_faturamento: pedido.data_faturamento,
        dt_envio_cliente: pedido.dt_envio_cliente,
        codigo_rastreio: pedido.codigo_rastreio,
      });
    }
  }, [pedido]);

  const isAdmin = profile?.role === 'admin';
  const canEdit = isAdmin || profile?.role === 'editor';

  const handleSave = async () => {
    if (!pedido || !canEdit) return;

    const updateData: Partial<Pedido> = {};

    if (formData.data_faturamento !== pedido.data_faturamento) {
      updateData.data_faturamento = formData.data_faturamento;
    }
    if (formData.dt_envio_cliente !== pedido.dt_envio_cliente) {
      updateData.dt_envio_cliente = formData.dt_envio_cliente;
    }
    if (formData.codigo_rastreio !== pedido.codigo_rastreio) {
      updateData.codigo_rastreio = formData.codigo_rastreio;
    }

    if (Object.keys(updateData).length === 0) {
      toast({
        title: 'Nenhuma alteração detectada',
        description: 'Nenhum campo foi modificado.',
      });
      onClose();
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos_pos_venda')
        .update(updateData)
        .eq('id', pedido.id)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        onUpdate(data[0] as Pedido);
      }

      toast({
        title: 'Pedido atualizado',
        description: 'As alterações foram salvas com sucesso.',
      });
      
      onClose();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (pedido) {
      setFormData({
        data_faturamento: pedido.data_faturamento,
        dt_envio_cliente: pedido.dt_envio_cliente,
        codigo_rastreio: pedido.codigo_rastreio,
      });
      toast({
        title: 'Campos resetados',
        description: 'As alterações foram desfeitas para o estado original.',
      });
    }
  };

  const formatDateForInput = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch {
      return '';
    }
  };

  if (!pedido) return null;

  const faturamentoInForm = formData.data_faturamento;
  const envioInForm = formData.dt_envio_cliente;

  const envioDisabled = !canEdit || (!isAdmin && !faturamentoInForm);
  const rastreioDisabled = !canEdit || (!isAdmin && (!faturamentoInForm || !envioInForm));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Pedido</DialogTitle>
          <DialogDescription>
            Pedido Interno: {pedido.pedido_interno} | Pedido Externo: {pedido.pedido_externo}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            {/* Row 1 */}
            <div>
                <Label>Cliente</Label>
                <Input value={pedido.cliente_fantasia || ''} disabled />
            </div>
            <div>
                <Label>Vendedor</Label>
                <Input value={pedido.vendedor_nome || ''} disabled />
            </div>

            {/* Row 2 */}
            <div>
                <Label>Data Ped Externo</Label>
                <Input type="date" value={formatDateForInput(pedido.data_externa)} disabled />
            </div>
            <div>
                <Label>Data Ped Interno</Label>
                <Input type="date" value={formatDateForInput(pedido.data_interna)} disabled />
            </div>

            {/* Row 3 - Editable Fields */}
            <div>
                <Label>Data do Faturamento</Label>
                <div className="relative flex items-center">
                  <Input 
                    type="date" 
                    value={formatDateForInput(formData.data_faturamento)}
                    onChange={(e) => setFormData({ ...formData, data_faturamento: e.target.value || null })}
                    disabled={!canEdit}
                    className="pr-10"
                  />
                  {formData.data_faturamento && canEdit && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-1 h-7 w-7"
                      onClick={() => setFormData({ ...formData, data_faturamento: null })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
            </div>
            <div>
              <Label>Data Envio</Label>
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div className="relative flex items-center w-full">
                      <Input
                        type="date"
                        value={formatDateForInput(formData.dt_envio_cliente)}
                        onChange={(e) => setFormData({ ...formData, dt_envio_cliente: e.target.value || null })}
                        disabled={envioDisabled}
                        className="pr-10"
                      />
                      {formData.dt_envio_cliente && canEdit && !envioDisabled && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-1 h-7 w-7"
                          onClick={() => setFormData({ ...formData, dt_envio_cliente: null })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TooltipTrigger>
                  {envioDisabled && canEdit && !isAdmin && (
                    <TooltipContent>
                      <p>É necessário preencher a Data do Faturamento primeiro.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Row 4 (Full Span) */}
            <div className="md:col-span-2">
              <Label>Código de Rastreio</Label>
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div className="relative flex items-center w-full">
                      <Input
                        value={formData.codigo_rastreio || ''}
                        onChange={(e) => setFormData({ ...formData, codigo_rastreio: e.target.value })}
                        disabled={rastreioDisabled}
                        placeholder="Digite o código de rastreio"
                        className="font-mono pr-10"
                      />
                      {formData.codigo_rastreio && canEdit && !rastreioDisabled && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-1 h-7 w-7"
                          onClick={() => setFormData({ ...formData, codigo_rastreio: '' })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TooltipTrigger>
                  {rastreioDisabled && canEdit && !isAdmin && (
                    <TooltipContent>
                        <p>É necessário preencher a Data do Faturamento e a Data de Envio.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end items-center space-x-2 pt-4">
              <Button variant="ghost" onClick={handleReset} disabled={loading}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Limpar Alterações
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PedidoEditModal;