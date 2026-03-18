import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogOut, Plus, Minus, Search, Settings, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StaffView = () => {
  const { API, getAuthHeader, logout, user } = useAuth();
  const { socket } = useSocket();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentOrder, setCurrentOrder] = useState(null);
  const [cart, setCart] = useState([]);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [manualItem, setManualItem] = useState({ name: '', price: '', quantity: 1 });

  useEffect(() => {
    fetchTables();
    fetchMenu();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('table_updated', () => {
        fetchTables();
      });
      socket.on('order_updated', () => {
        if (currentOrder) {
          fetchOrder(currentOrder.id);
        }
      });
    }
  }, [socket, currentOrder]);

  const fetchTables = async () => {
    try {
      const response = await axios.get(`${API}/tables`, { headers: getAuthHeader() });
      setTables(response.data);
    } catch (error) {
      toast.error('Failed to load tables');
    }
  };

  const fetchMenu = async () => {
    try {
      const response = await axios.get(`${API}/menu`, { headers: getAuthHeader() });
      setMenuItems(response.data);
    } catch (error) {
      toast.error('Failed to load menu');
    }
  };

  const fetchOrder = async (orderId) => {
    try {
      const response = await axios.get(`${API}/orders/${orderId}`, { headers: getAuthHeader() });
      setCurrentOrder(response.data);
    } catch (error) {
      toast.error('Failed to load order');
    }
  };

  const handleTableClick = async (table) => {
    setSelectedTable(table);
    setCart([]);
    setManualItem({ name: '', price: '', quantity: 1 });
    
    if (table.status === 'running' && table.current_order_id) {
      await fetchOrder(table.current_order_id);
    } else {
      // Create new order
      try {
        const response = await axios.post(`${API}/orders`, 
          { table_id: table.id },
          { headers: getAuthHeader() }
        );
        setCurrentOrder(response.data);
      } catch (error) {
        toast.error('Failed to create order');
        return;
      }
    }
    
    setShowOrderDialog(true);
  };

  const addToCart = (item) => {
    const existing = cart.find(c => c.menu_item_id === item.id);
    if (existing) {
      setCart(cart.map(c => 
        c.menu_item_id === item.id 
          ? { ...c, quantity: c.quantity + 1 } 
          : c
      ));
    } else {
      setCart([...cart, {
        menu_item_id: item.id,
        item_name: item.name,
        quantity: 1,
        price: item.price,
        is_manual: false
      }]);
    }
  };

  const updateCartQuantity = (index, delta) => {
    const newCart = [...cart];
    newCart[index].quantity = Math.max(1, newCart[index].quantity + delta);
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const addManualItem = () => {
    if (!manualItem.name || !manualItem.price) {
      toast.error('Please enter item name and price');
      return;
    }
    
    setCart([...cart, {
      menu_item_id: null,
      item_name: manualItem.name,
      quantity: manualItem.quantity,
      price: parseFloat(manualItem.price),
      is_manual: true
    }]);
    
    setManualItem({ name: '', price: '', quantity: 1 });
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    
    try {
      await axios.post(
        `${API}/orders/${currentOrder.id}/items`,
        { items: cart },
        { headers: getAuthHeader() }
      );
      
      toast.success('Order items added successfully!');
      setCart([]);
      await fetchOrder(currentOrder.id);
      setShowOrderDialog(false);
      await fetchTables();
    } catch (error) {
      toast.error('Failed to add items');
    }
  };

  const cancelOrder = async () => {
    if (!currentOrder) return;
    
    if (!window.confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/orders/${currentOrder.id}`, { headers: getAuthHeader() });
      toast.success('Order cancelled successfully');
      setShowOrderDialog(false);
      setCurrentOrder(null);
      setCart([]);
      await fetchTables();
    } catch (error) {
      toast.error('Failed to cancel order');
    }
  };

  const filteredMenu = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTableStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-white border-2 border-slate-200 text-slate-600';
      case 'running':
        return 'bg-[#FFF8ED] border-2 border-[#C9A961] text-[#B8945F]';
      case 'closed':
        return 'bg-slate-100 border-2 border-slate-300 text-slate-400 opacity-70';
      default:
        return 'bg-white border-2 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="staff-view">
      {/* Header */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 z-40 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>Tables</h1>
          <div className="flex gap-2">
            {user?.role === 'admin' && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/admin')}
                className="rounded-full border-slate-200"
                data-testid="admin-button"
              >
                <Settings className="w-5 h-5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/history')}
              className="rounded-full border-slate-200"
              data-testid="history-button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/reception')}
              className="rounded-full border-slate-200"
              data-testid="reception-button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2z" />
              </svg>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={logout}
              className="rounded-full border-slate-200"
              data-testid="logout-button"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 p-4 pb-24">
        {tables.map((table) => (
          <Card
            key={table.id}
            className={`flex flex-col items-center justify-center aspect-square rounded-xl transition-all active:scale-95 cursor-pointer ${getTableStatusColor(table.status)} hover:shadow-md`}
            onClick={() => handleTableClick(table)}
            data-testid={`table-card-${table.table_number}`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>{table.table_number}</div>
              <div className="text-xs font-medium uppercase tracking-wide">{table.status}</div>
              <div className="text-xs mt-1">Cap: {table.capacity}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="order-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Table {selectedTable?.table_number}
            </DialogTitle>
          </DialogHeader>

          {/* Search Menu */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-slate-200 focus:border-[#E14D2A] focus:ring-[#E14D2A]"
                data-testid="menu-search-input"
              />
            </div>

            {/* Menu Items */}
            <div className="max-h-48 overflow-y-auto space-y-2">
              {filteredMenu.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                  onClick={() => addToCart(item)}
                  data-testid={`menu-item-${item.id}`}
                >
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.category}</div>
                  </div>
                  <div className="font-bold mono">{formatPrice(item.price)}</div>
                </div>
              ))}
            </div>

            {/* Manual Entry */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Manual Entry</h3>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Item name"
                  value={manualItem.name}
                  onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                  className="border-slate-200"
                  data-testid="manual-item-name"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  value={manualItem.price}
                  onChange={(e) => setManualItem({ ...manualItem, price: e.target.value })}
                  className="border-slate-200"
                  data-testid="manual-item-price"
                />
                <Button
                  onClick={addManualItem}
                  className="bg-[#E14D2A] hover:bg-[#C24123] text-white rounded-full"
                  data-testid="add-manual-item-button"
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Cart</h3>
                <div className="space-y-2">
                  {cart.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-[#FFF8ED] border border-[#C9A961] rounded-lg" data-testid={`cart-item-${index}`}>
                      <div className="flex-1">
                        <div className="font-medium">{item.item_name}</div>
                        {item.is_manual && <div className="text-xs text-[#B8945F]">Manual Entry</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => updateCartQuantity(index, -1)}
                          data-testid={`decrease-quantity-${index}`}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => updateCartQuantity(index, 1)}
                          data-testid={`increase-quantity-${index}`}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <div className="w-20 text-right font-bold mono">{formatPrice(item.price * item.quantity)}</div>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => removeFromCart(index)}
                          data-testid={`remove-cart-item-${index}`}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <div className="text-lg font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>Total</div>
                  <div className="text-2xl font-bold mono">{formatPrice(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0))}</div>
                </div>
                <Button
                  onClick={submitOrder}
                  className="w-full mt-4 bg-[#C9A961] hover:bg-[#B8945F] text-white rounded-full font-medium"
                  data-testid="submit-order-button"
                >
                  Submit Order
                </Button>
              </div>
            )}

            {/* Current Order Items */}
            {currentOrder && currentOrder.items.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Current Order</h3>
                <div className="space-y-2">
                  {currentOrder.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-slate-500">Qty: {item.quantity}</div>
                      </div>
                      <div className="font-bold mono">{formatPrice(item.price * item.quantity)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <div className="text-lg font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>Order Total</div>
                  <div className="text-2xl font-bold mono text-[#C9A961]">{formatPrice(currentOrder.total)}</div>
                </div>
                <Button
                  onClick={cancelOrder}
                  variant="destructive"
                  className="w-full mt-4 rounded-full"
                  data-testid="cancel-order-button"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cancel Order
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffView;
