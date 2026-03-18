import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const HistoryPage = () => {
  const { API, getAuthHeader } = useAuth();
  const { formatPrice, taxEnabled, taxName } = useCurrency();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/orders?status=completed`, { headers: getAuthHeader() });
      setOrders(response.data.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)));
    } catch (error) {
      console.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order =>
    order.table_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50" data-testid="history-page">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-full border-slate-200 hover:border-[#C9A961] hover:text-[#C9A961] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#2C5F5D] to-[#1F4644] bg-clip-text text-transparent" style={{ fontFamily: 'DM Sans, sans-serif' }}>Order History</h1>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by table or order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-slate-200"
          />
        </div>
      </div>

      {/* History List */}
      <div className="p-4 space-y-4">
        {loading ? (
          <Card className="p-12 text-center border-slate-200">
            <div className="text-slate-400">Loading history...</div>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card className="p-12 text-center border-slate-200">
            <div className="text-slate-400">
              {searchQuery ? 'No orders found' : 'No completed orders yet'}
            </div>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="p-4 border-slate-200 shadow-sm hover:shadow-lg transition-all duration-200 bg-white">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-xl font-bold text-[#2C5F5D]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                    Table {order.table_number}
                  </h3>
                  <div className="text-sm text-slate-500">
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      {order.completed_at ? format(new Date(order.completed_at), 'MMM dd, yyyy HH:mm') : 'N/A'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Order ID: {order.id.substring(0, 8)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">Total</div>
                  <div className="text-2xl font-bold mono bg-gradient-to-r from-[#C9A961] to-[#B8945F] bg-clip-text text-transparent">{formatPrice(order.total)}</div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2 mt-4">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between p-2 bg-slate-50 rounded">
                    <div>
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-sm text-slate-500">Qty: {item.quantity}</div>
                    </div>
                    <div className="font-medium mono">{formatPrice(item.price * item.quantity)}</div>
                  </div>
                ))}
              </div>

              {/* Totals Breakdown */}
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium mono">{formatPrice(order.subtotal || order.total)}</span>
                </div>
                {taxEnabled && order.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{taxName} ({order.tax_rate}%)</span>
                    <span className="font-medium mono">{formatPrice(order.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total</span>
                  <span className="mono text-[#C9A961]">{formatPrice(order.total)}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
