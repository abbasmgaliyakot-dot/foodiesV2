import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { LogOut, Printer, Check, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ReceptionDashboard = () => {
  const { API, getAuthHeader, logout } = useAuth();
  const { socket } = useSocket();
  const { formatPrice, currencySymbol, taxEnabled, taxName } = useCurrency();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showBillDialog, setShowBillDialog] = useState(false);

  useEffect(() => {
    fetchTables();
    fetchOrders();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('table_updated', () => {
        fetchTables();
      });
      socket.on('order_created', () => {
        fetchOrders();
      });
      socket.on('order_updated', (updatedOrder) => {
        fetchOrders();
        if (selectedOrder && selectedOrder.id === updatedOrder.id) {
          setSelectedOrder(updatedOrder);
        }
      });
      socket.on('order_completed', () => {
        fetchOrders();
        fetchTables();
      });
    }
  }, [socket, selectedOrder]);

  const fetchTables = async () => {
    try {
      const response = await axios.get(`${API}/tables`, { headers: getAuthHeader() });
      setTables(response.data);
    } catch (error) {
      toast.error('Failed to load tables');
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders?status=active`, { headers: getAuthHeader() });
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to load orders');
    }
  };

  const acknowledgeOrder = async (orderId) => {
    try {
      await axios.post(`${API}/orders/${orderId}/acknowledge`, {}, { headers: getAuthHeader() });
      fetchOrders();
    } catch (error) {
      toast.error('Failed to acknowledge order');
    }
  };

  const printKitchenOrder = (order) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    const orderDate = new Date(order.created_at).toLocaleString();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kitchen Order - Table ${order.table_number}</title>
        <style>
          body {
            font-family: 'JetBrains Mono', monospace;
            padding: 20px;
            max-width: 400px;
          }
          h1 {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .order-info {
            margin: 20px 0;
            font-weight: bold;
          }
          .item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px dashed #ccc;
          }
          .item-name {
            flex: 1;
          }
          .item-qty {
            margin-left: 20px;
            font-weight: bold;
          }
          .new-item {
            background-color: #FFF1EE;
            padding: 8px;
            margin: -8px 0;
          }
        </style>
      </head>
      <body>
        <h1>KITCHEN ORDER</h1>
        <div class="order-info">
          <div>TABLE: ${order.table_number}</div>
          <div>ORDER ID: ${order.id.substring(0, 8)}</div>
          <div>TIME: ${orderDate}</div>
        </div>
        <div>
          ${order.items.map(item => `
            <div class="item ${item.is_new ? 'new-item' : ''}">
              <span class="item-name">${item.item_name}</span>
              <span class="item-qty">x${item.quantity}</span>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const generateBill = (order) => {
    setSelectedOrder(order);
    setShowBillDialog(true);
  };

  const printBill = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    const billDate = new Date().toLocaleString();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill - Table ${selectedOrder.table_number}</title>
        <style>
          body {
            font-family: 'Inter', sans-serif;
            padding: 20px;
            max-width: 400px;
          }
          h1 {
            text-align: center;
            font-family: 'DM Sans', sans-serif;
          }
          .restaurant-name {
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
          }
          .bill-info {
            margin: 20px 0;
            text-align: center;
          }
          .item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .total-section {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 2px solid #000;
          }
          .total {
            display: flex;
            justify-content: space-between;
            font-size: 20px;
            font-weight: bold;
            margin: 10px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="restaurant-name">Foodies Junction</div>
        <h1>BILL</h1>
        <div class="bill-info">
          <div>Table: ${selectedOrder.table_number}</div>
          <div>Date: ${billDate}</div>
        </div>
        <div>
          ${selectedOrder.items.map(item => `
            <div class="item">
              <div>
                <div>${item.item_name}</div>
                <div style="font-size: 12px; color: #666;">${item.quantity} x ${currencySymbol}${item.price.toFixed(2)}</div>
              </div>
              <div style="font-weight: bold;">${currencySymbol}${(item.price * item.quantity).toFixed(2)}</div>
            </div>
          `).join('')}
        </div>
        <div class="total-section">
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>Subtotal</span>
            <span>${currencySymbol}${(selectedOrder.subtotal || selectedOrder.total).toFixed(2)}</span>
          </div>
          ${selectedOrder.tax_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>${taxName} (${selectedOrder.tax_rate}%)</span>
            <span>${currencySymbol}${selectedOrder.tax_amount.toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="total">
            <span>TOTAL</span>
            <span>${currencySymbol}${selectedOrder.total.toFixed(2)}</span>
          </div>
        </div>
        <div class="footer">
          <p>Thank you for dining with us!</p>
          <p>Visit again soon</p>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const completeOrder = async () => {
    try {
      await axios.post(`${API}/orders/${selectedOrder.id}/complete`, {}, { headers: getAuthHeader() });
      toast.success('Order completed!');
      setShowBillDialog(false);
      setSelectedOrder(null);
      fetchOrders();
      fetchTables();
    } catch (error) {
      toast.error('Failed to complete order');
    }
  };

  const getOrderTable = (orderId) => {
    const table = tables.find(t => t.current_order_id === orderId);
    return table;
  };

  const hasNewItems = (order) => {
    return order.items.some(item => item.is_new);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="reception-dashboard">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-full border-slate-200"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>Reception Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/history')}
              className="rounded-full border-slate-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </Button>
            <Button
              variant="outline"
              onClick={logout}
              className="rounded-full border-slate-200"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Tables Overview */}
      <div className="p-4 md:p-6">
        <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>Running Tables</h2>
        
        {orders.length === 0 ? (
          <Card className="p-8 text-center border-slate-200">
            <div className="text-slate-400">No active orders</div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => {
              const table = getOrderTable(order.id);
              return (
                <Card
                  key={order.id}
                  className={`p-4 border-2 transition-all hover:shadow-lg ${
                    hasNewItems(order) ? 'border-[#C9A961] bg-[#FFF8ED]' : 'border-slate-200'
                  }`}
                  data-testid={`order-card-${order.table_number}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                        Table {order.table_number}
                      </h3>
                      <div className="text-xs text-slate-500">
                        {new Date(order.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                    {hasNewItems(order) && (
                      <div className="bg-[#C9A961] text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                        NEW
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
                    {order.items.map((item, index) => (
                      <div
                        key={index}
                        className={`flex justify-between p-1.5 text-sm rounded ${
                          item.is_new ? 'bg-[#FFF8ED] border border-[#C9A961]' : 'bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-sm">{item.item_name}</div>
                          <div className="text-xs text-slate-500">Qty: {item.quantity}</div>
                        </div>
                        <div className="font-bold mono text-sm">{formatPrice(item.price * item.quantity)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mb-3 pt-3 border-t border-slate-200">
                    <span className="font-bold text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>Total</span>
                    <span className="text-xl font-bold mono text-[#C9A961]">{formatPrice(order.total)}</span>
                  </div>

                  <div className="flex gap-1.5">
                    {hasNewItems(order) && (
                      <Button
                        onClick={() => acknowledgeOrder(order.id)}
                        variant="outline"
                        className="flex-1 rounded-full border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961] hover:text-white"
                        data-testid={`acknowledge-button-${order.table_number}`}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      onClick={() => printKitchenOrder(order)}
                      variant="outline"
                      className="flex-1 rounded-full border-slate-200"
                      data-testid={`print-button-${order.table_number}`}
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                    </Button>
                    <Button
                      onClick={() => generateBill(order)}
                      className="flex-1 bg-[#C9A961] hover:bg-[#B8945F] text-white rounded-full"
                      data-testid={`bill-button-${order.table_number}`}
                    >
                      Bill
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Bill Dialog */}
      <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
        <DialogContent className="max-w-md" data-testid="bill-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Final Bill - Table {selectedOrder?.table_number}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="space-y-2">
                {selectedOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between p-2 bg-slate-50 rounded">
                    <div>
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-sm text-slate-500">{item.quantity} x ${item.price.toFixed(2)}</div>
                    </div>
                    <div className="font-bold mono">{formatPrice(item.price * item.quantity)}</div>
                  </div>
                ))}
              </div>

              <div className="pt-4 space-y-2 border-t border-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium mono">{formatPrice(selectedOrder.subtotal || selectedOrder.total)}</span>
                </div>
                {selectedOrder.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{taxName} ({selectedOrder.tax_rate}%)</span>
                    <span className="font-medium mono">{formatPrice(selectedOrder.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t-2 border-slate-900">
                  <span className="text-xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>TOTAL</span>
                  <span className="text-3xl font-bold mono">{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={printBill}
                  variant="outline"
                  className="flex-1 rounded-full border-slate-200"
                  data-testid="print-bill-button"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print Bill
                </Button>
                <Button
                  onClick={completeOrder}
                  className="flex-1 bg-[#C9A961] hover:bg-[#B8945F] text-white rounded-full"
                  data-testid="complete-order-button"
                >
                  Complete & Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceptionDashboard;
