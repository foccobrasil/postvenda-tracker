import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Edit,
  LogOut,
  X,
  ArrowUp,
  ArrowDown,
  Calendar as CalendarIcon,
  ArrowUpDown,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
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

interface GroupedPedido {
  clientName: string;
  pedidos: Pedido[];
  urgentDaysWaiting: number | '-';
  allTracked: boolean;
}

const Index = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [month, setMonth] = useState<string>(
    (new Date().getMonth() + 1).toString()
  );
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<
    Record<string, Set<string>>
  >({});
  const [bulkFaturamentoDate, setBulkFaturamentoDate] = useState<
    Record<string, Date | undefined>
  >({});
  const [bulkShipDate, setBulkShipDate] = useState<
    Record<string, Date | undefined>
  >({});
  const [bulkTrackingCode, setBulkTrackingCode] = useState<
    Record<string, string>
  >({});
  const [sortBy, setSortBy] = useState<'alphabetical' | 'urgency'>(
    'alphabetical'
  );

  const years = Array.from({ length: 10 }, (_, i) =>
    (new Date().getFullYear() - i).toString()
  );
  const months = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchText]);

  const calculateDiasAguardando = useCallback(
    (dtEnvioCliente: string | null, dataExterna: string | null) => {
      if (!dataExterna) return '-';
      const dataBase = dtEnvioCliente ? new Date(dtEnvioCliente) : new Date();
      const dataInicial = new Date(dataExterna);
      const diff = differenceInDays(dataBase, dataInicial);
      return isNaN(diff) ? '-' : diff;
    },
    []
  );

  const processedPedidos = useMemo(() => {
    let filteredByDate = [...pedidos];
    if (year && month) {
      filteredByDate = filteredByDate.filter((pedido) => {
        if (!pedido.data_interna) return false;
        const pedidoDate = new Date(pedido.data_interna);
        return (
          pedidoDate.getFullYear().toString() === year &&
          (pedidoDate.getMonth() + 1).toString() === month
        );
      });
    }

    const grouped: Record<string, Pedido[]> = {};
    filteredByDate.forEach((p) => {
      const clientName = p.cliente_fantasia || 'Cliente Desconhecido';
      if (!grouped[clientName]) {
        grouped[clientName] = [];
      }
      grouped[clientName].push(p);
    });

    let clientGroups: GroupedPedido[] = Object.entries(grouped).map(
      ([clientName, clientPedidos]) => {
        const ordersWithoutTracking = clientPedidos.filter(
          (p) => !p.codigo_rastreio
        );
        let urgentDaysWaiting: number | '-' = '-';

        if (ordersWithoutTracking.length > 0) {
          const oldestOrder = ordersWithoutTracking.reduce(
            (oldest, current) => {
              if (!current.data_externa) return oldest;
              if (!oldest.data_externa) return current;
              return new Date(current.data_externa) <
                new Date(oldest.data_externa)
                ? current
                : oldest;
            }
          );
          urgentDaysWaiting = calculateDiasAguardando(
            oldestOrder.dt_envio_cliente,
            oldestOrder.data_externa
          );
        }

        return {
          clientName,
          pedidos: clientPedidos,
          urgentDaysWaiting,
          allTracked: ordersWithoutTracking.length === 0,
        };
      }
    );

    if (debouncedSearchText) {
      clientGroups = clientGroups.filter((group) =>
        group.clientName
          .toLowerCase()
          .includes(debouncedSearchText.toLowerCase())
      );
    }

    if (sortBy === 'alphabetical') {
      clientGroups.sort((a, b) => a.clientName.localeCompare(b.clientName));
    } else {
      // sortBy === 'urgency'
      clientGroups.sort((a, b) => {
        const aValue = a.urgentDaysWaiting;
        const bValue = b.urgentDaysWaiting;
        if (aValue === '-') return 1;
        if (bValue === '-') return -1;
        return (bValue as number) - (aValue as number);
      });
    }

    return clientGroups;
  }, [
    pedidos,
    debouncedSearchText,
    month,
    year,
    sortBy,
    calculateDiasAguardando,
  ]);

  const toggleSort = () => {
    setSortBy((prev) => (prev === 'alphabetical' ? 'urgency' : 'alphabetical'));
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchPedidos();
    }
  }, [user, authLoading]);

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

  const handleUpdatePedido = (updatedPedido: Pedido) => {
    setPedidos(
      pedidos.map((p) => (p.id === updatedPedido.id ? updatedPedido : p))
    );
  };

  const handleSelectOrder = (clientName: string, pedidoId: string) => {
    setSelectedOrders((prev) => {
      const newSelection = new Set(prev[clientName] || []);
      if (newSelection.has(pedidoId)) {
        newSelection.delete(pedidoId);
      } else {
        newSelection.add(pedidoId);
      }
      return { ...prev, [clientName]: newSelection };
    });
  };

  const handleSelectAllOrders = (
    clientName: string,
    clientPedidos: Pedido[]
  ) => {
    setSelectedOrders((prev) => {
      const currentSelection = prev[clientName] || new Set();
      const allIds = clientPedidos.map((p) => p.id);
      if (currentSelection.size === allIds.length) {
        return { ...prev, [clientName]: new Set() };
      } else {
        return { ...prev, [clientName]: new Set(allIds) };
      }
    });
  };

  const handleBulkSave = async (clientName: string) => {
    const selectedIds = selectedOrders[clientName];
    if (!selectedIds || selectedIds.size === 0) {
      toast({
        title: 'Nenhum pedido selecionado',
        description: 'Selecione ao menos um pedido para salvar.',
        variant: 'destructive',
      });
      return;
    }

    const faturamentoDate = bulkFaturamentoDate[clientName];
    const shipDate = bulkShipDate[clientName];
    const track = bulkTrackingCode[clientName];

    if (!faturamentoDate && !shipDate && !track) {
      toast({
        title: 'Nenhum dado para salvar',
        description: 'Preencha ao menos um campo para o lote.',
        variant: 'destructive',
      });
      return;
    }

    const updateData: Partial<Pedido> = {};
    if (faturamentoDate)
      updateData.data_faturamento = format(faturamentoDate, 'yyyy-MM-dd');
    if (shipDate) updateData.dt_envio_cliente = format(shipDate, 'yyyy-MM-dd');
    if (track) updateData.codigo_rastreio = track;

    setLoading(true);
    try {
      const updates = Array.from(selectedIds).map((id) =>
        supabase.from('pedidos_pos_venda').update(updateData).eq('id', id)
      );
      const results = await Promise.all(updates);
      const errorResult = results.find((res) => res.error);

      if (errorResult) throw errorResult.error;

      toast({
        title: 'Pedidos atualizados',
        description: `${selectedIds.size} pedidos foram atualizados com sucesso.`,
      });

      const newPedidos = pedidos.map((p) => {
        if (selectedIds.has(p.id)) {
          return { ...p, ...updateData };
        }
        return p;
      });
      setPedidos(newPedidos);

      setSelectedOrders((prev) => ({ ...prev, [clientName]: new Set() }));
      setBulkFaturamentoDate((prev) => ({ ...prev, [clientName]: undefined }));
      setBulkShipDate((prev) => ({ ...prev, [clientName]: undefined }));
      setBulkTrackingCode((prev) => ({ ...prev, [clientName]: '' }));
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar em lote',
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
      return format(parseISO(dateString), 'dd/MM/yyyy');
    } catch {
      return '-';
    }
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

  if (authLoading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        Carregando...
      </div>
    );
  if (!user) {
    window.location.href = '/';
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-brand-blue">
              Controle de Pós-Venda
            </h1>
            <p className="text-muted-foreground">
              Bem-vindo, {profile?.full_name || profile?.email} |{' '}
              {profile?.role}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="relative flex-grow">
                <label className="text-sm font-medium">Buscar Cliente</label>
                <Search className="absolute left-3 top-8 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do cliente..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10 mt-1 w-full"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium">Mês</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="mt-1 w-[180px]">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium">Ano</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="mt-1 w-[120px]">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Clientes ({processedPedidos.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={toggleSort}>
              <ArrowUpDown className="mr-2 h-4 w-4" />
              {sortBy === 'alphabetical'
                ? 'Ordenar por Urgência'
                : 'Ordenar Alfabeticamente'}
            </Button>
          </CardHeader>
          <CardContent>
            {loading && pedidos.length === 0 ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {processedPedidos.map((group) => {
                  const selectedIds =
                    selectedOrders[group.clientName] || new Set();
                  const faturamentoInBulk =
                    bulkFaturamentoDate[group.clientName];
                  const envioInBulk = bulkShipDate[group.clientName];
                  const bulkEnvioDisabled = !faturamentoInBulk;
                  const bulkRastreioDisabled =
                    !faturamentoInBulk || !envioInBulk;

                  return (
                    <AccordionItem
                      value={group.clientName}
                      key={group.clientName}
                    >
                      <AccordionTrigger>
                        <div className="flex justify-between items-center w-full">
                          <span className="font-bold text-primary">
                            {group.clientName} ({group.pedidos.length} pedidos)
                          </span>
                          {group.allTracked ? (
                            <span className="text-green-600 font-semibold text-sm">
                              OK - Em dia
                            </span>
                          ) : (
                            <span
                              className={cn(
                                'text-sm font-semibold',
                                (group.urgentDaysWaiting as number) >= 5 &&
                                  'text-red-600'
                              )}
                            >
                              Aguardando há: {group.urgentDaysWaiting} dias
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`select-all-${group.clientName}`}
                                checked={
                                  selectedIds.size === group.pedidos.length &&
                                  group.pedidos.length > 0
                                }
                                onCheckedChange={() =>
                                  handleSelectAllOrders(
                                    group.clientName,
                                    group.pedidos
                                  )
                                }
                              />
                              <label
                                htmlFor={`select-all-${group.clientName}`}
                                className="text-sm font-medium"
                              >
                                Selecionar Todos
                              </label>
                            </div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-[200px] justify-start text-left font-normal"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {bulkFaturamentoDate[group.clientName] ? (
                                    format(
                                      bulkFaturamentoDate[group.clientName]!,
                                      'dd/MM/yyyy'
                                    )
                                  ) : (
                                    <span>Data Faturamento</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={
                                    bulkFaturamentoDate[group.clientName]
                                  }
                                  onSelect={(date) =>
                                    setBulkFaturamentoDate((prev) => ({
                                      ...prev,
                                      [group.clientName]: date,
                                    }))
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <TooltipProvider>
                              <Tooltip delayDuration={100}>
                                <TooltipTrigger asChild>
                                  <div className="w-[200px]">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            'w-full justify-start text-left font-normal',
                                            bulkEnvioDisabled &&
                                              'cursor-not-allowed opacity-50'
                                          )}
                                          disabled={bulkEnvioDisabled}
                                        >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {bulkShipDate[group.clientName] ? (
                                            format(
                                              bulkShipDate[group.clientName]!,
                                              'dd/MM/yyyy'
                                            )
                                          ) : (
                                            <span>Data de Envio</span>
                                          )}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar
                                          mode="single"
                                          selected={
                                            bulkShipDate[group.clientName]
                                          }
                                          onSelect={(date) =>
                                            setBulkShipDate((prev) => ({
                                              ...prev,
                                              [group.clientName]: date,
                                            }))
                                          }
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </TooltipTrigger>
                                {bulkEnvioDisabled && (
                                  <TooltipContent>
                                    <p>
                                      É necessário preencher a Data de
                                      Faturamento em lote primeiro.
                                    </p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip delayDuration={100}>
                                <TooltipTrigger asChild>
                                  <div className="flex-1 min-w-[200px]">
                                    <Input
                                      placeholder="Código de Rastreio em Lote"
                                      className="w-full"
                                      value={
                                        bulkTrackingCode[group.clientName] || ''
                                      }
                                      onChange={(e) =>
                                        setBulkTrackingCode((prev) => ({
                                          ...prev,
                                          [group.clientName]: e.target.value,
                                        }))
                                      }
                                      disabled={bulkRastreioDisabled}
                                    />
                                  </div>
                                </TooltipTrigger>
                                {bulkRastreioDisabled && (
                                  <TooltipContent>
                                    <p>
                                      É necessário preencher a Data de
                                      Faturamento e a Data de Envio em lote.
                                    </p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              size="sm"
                              onClick={() => handleBulkSave(group.clientName)}
                            >
                              Salvar Lote
                            </Button>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Pedido Interno</TableHead>
                                <TableHead>Data Faturamento</TableHead>
                                <TableHead>Data Interna</TableHead>
                                <TableHead>Dias Aguardando</TableHead>
                                <TableHead>Cód. Rastreio</TableHead>
                                <TableHead className="text-right">
                                  Ações
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.pedidos.map((pedido) => {
                                const diasAguardando = calculateDiasAguardando(
                                  pedido.dt_envio_cliente,
                                  pedido.data_externa
                                );
                                const isUrgent =
                                  typeof diasAguardando === 'number' &&
                                  diasAguardando >= 5;
                                return (
                                  <TableRow key={pedido.id}>
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedIds.has(pedido.id)}
                                        onCheckedChange={() =>
                                          handleSelectOrder(
                                            group.clientName,
                                            pedido.id
                                          )
                                        }
                                      />
                                    </TableCell>
                                    <TableCell>
                                      {pedido.pedido_interno}
                                    </TableCell>
                                    <TableCell>
                                      {formatDate(pedido.data_faturamento)}
                                    </TableCell>
                                    <TableCell>
                                      {formatDate(pedido.data_interna)}
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        isUrgent && 'text-red-600 font-bold'
                                      )}
                                    >
                                      {diasAguardando}
                                    </TableCell>
                                    <TableCell>
                                      {pedido.codigo_rastreio || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleEditClick(pedido)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <PedidoEditModal
          pedido={selectedPedido}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onUpdate={handleUpdatePedido}
        />
      </div>
    </div>
  );
};

export default Index;
