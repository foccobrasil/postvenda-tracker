import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Edit, LogOut } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import PedidoEditModal from '@/components/PedidoEditModal';

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

const Index = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      fetchPedidos();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!search) {
      setFilteredPedidos(pedidos);
    } else {
      const filtered = pedidos.filter(
        (pedido) =>
          pedido.pedido_interno?.toString().includes(search) ||
          pedido.pedido_externo?.toLowerCase().includes(search.toLowerCase()) ||
          pedido.cliente_fantasia?.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredPedidos(filtered);
    }
  }, [search, pedidos]);

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos_pos_venda')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar pedidos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  const calculateDiasAguardando = (dtEnvioCliente: string | null, dataExterna: string | null) => {
    if (!dataExterna) return '-';
    
    const dataBase = dtEnvioCliente ? new Date(dtEnvioCliente) : new Date();
    const dataInicial = new Date(dataExterna);
    
    return differenceInDays(dataBase, dataInicial).toString();
  };

  const handleEditClick = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setModalOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: 'Logout realizado',
      description: 'Você foi desconectado do sistema.',
    });
  };

  if (authLoading) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  
  if (!user) {
    window.location.href = '/';
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Controle de Pós-Venda</h1>
            <p className="text-muted-foreground">
              Bem-vindo, {profile?.full_name || profile?.email} | Role: {profile?.role}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por pedido interno, externo ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos ({filteredPedidos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando pedidos...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido Externo</TableHead>
                    <TableHead>Pedido Interno</TableHead>
                    <TableHead>Data Interna</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Data Faturamento</TableHead>
                    <TableHead>Data Envio Cliente</TableHead>
                    <TableHead>Dias Aguardando</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPedidos.map((pedido) => (
                    <TableRow key={pedido.id}>
                      <TableCell>{pedido.pedido_externo || '-'}</TableCell>
                      <TableCell className="font-mono">{pedido.pedido_interno}</TableCell>
                      <TableCell>{formatDate(pedido.data_interna)}</TableCell>
                      <TableCell>{pedido.cliente_fantasia || '-'}</TableCell>
                      <TableCell>{pedido.vendedor_nome || '-'}</TableCell>
                      <TableCell>{formatDate(pedido.data_faturamento)}</TableCell>
                      <TableCell>{formatDate(pedido.dt_envio_cliente)}</TableCell>
                      <TableCell>{calculateDiasAguardando(pedido.dt_envio_cliente, pedido.data_externa)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(pedido)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <PedidoEditModal
          pedido={selectedPedido}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onUpdate={fetchPedidos}
        />
      </div>
    </div>
  );
};

export default Index;
