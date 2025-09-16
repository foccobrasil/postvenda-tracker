import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
  onUpdate: () => void;
}

const PedidoEditModal = ({ pedido, open, onClose, onUpdate }: PedidoEditModalProps) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Pedido>>({});

  useEffect(() => {
    if (pedido) {
      setFormData({
        dt_envio_pos_venda: pedido.dt_envio_pos_venda,
        dt_envio_cliente: pedido.dt_envio_cliente,
        codigo_rastreio: pedido.codigo_rastreio,
      });
    }
  }, [pedido]);

  const canEdit = profile?.role === 'admin' || profile?.role === 'editor';
  const isEditor = profile?.role === 'editor';

  const handleSave = async () => {
    if (!pedido || !canEdit) return;

    setLoading(true);
    try {
      const updateData: any = {};
      
      if (formData.dt_envio_pos_venda !== undefined) {
        updateData.dt_envio_pos_venda = formData.dt_envio_pos_venda;
      }
      if (formData.dt_envio_cliente !== undefined) {
        updateData.dt_envio_cliente = formData.dt_envio_cliente;
      }
      if (formData.codigo_rastreio !== undefined) {
        updateData.codigo_rastreio = formData.codigo_rastreio;
      }

      const { error } = await supabase
        .from('pedidos_pos_venda')
        .update(updateData)
        .eq('id', pedido.id);

      if (error) throw error;

      toast({
        title: 'Pedido atualizado',
        description: 'As alterações foram salvas com sucesso.',
      });
      
      onUpdate();
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

  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch {
      return '';
    }
  };

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Pedido</DialogTitle>
          <DialogDescription>
            Pedido Interno: {pedido.pedido_interno} | Pedido Externo: {pedido.pedido_externo}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cliente</Label>
              <Input value={pedido.cliente_fantasia || ''} disabled />
            </div>
            <div>
              <Label>Vendedor</Label>
              <Input value={pedido.vendedor_nome || ''} disabled />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Externa</Label>
              <Input 
                type="date" 
                value={formatDateForInput(pedido.data_externa)} 
                disabled 
              />
            </div>
            <div>
              <Label>Data Interna</Label>
              <Input 
                type="date" 
                value={formatDateForInput(pedido.data_interna)} 
                disabled 
              />
            </div>
          </div>

          <div>
            <Label>Data Faturamento</Label>
            <Input 
              type="date" 
              value={formatDateForInput(pedido.data_faturamento)} 
              disabled 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Envio Pós-Venda</Label>
              <Input
                type="date"
                value={formatDateForInput(formData.dt_envio_pos_venda || null)}
                onChange={(e) => setFormData({ ...formData, dt_envio_pos_venda: e.target.value || null })}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label>Data Envio Cliente</Label>
              <Input
                type="date"
                value={formatDateForInput(formData.dt_envio_cliente || null)}
                onChange={(e) => setFormData({ ...formData, dt_envio_cliente: e.target.value || null })}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div>
            <Label>Código de Rastreio</Label>
            <Input
              value={formData.codigo_rastreio || ''}
              onChange={(e) => setFormData({ ...formData, codigo_rastreio: e.target.value })}
              disabled={!canEdit}
              placeholder="Digite o código de rastreio"
            />
          </div>

          {canEdit && (
            <div className="flex justify-end space-x-2 pt-4">
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