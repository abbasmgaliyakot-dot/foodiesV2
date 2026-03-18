import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, ArrowLeft, Users, UtensilsCrossed, Table as TableIcon, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminPanel = () => {
  const { API, getAuthHeader, logout } = useAuth();
  const { formatPrice, currencySymbol, currencyCode, taxEnabled, taxRate, taxName, updateCurrency, updateTaxSettings } = useCurrency();
  const navigate = useNavigate();
  
  // State
  const [users, setUsers] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  
  // Dialog states
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [showMenuDialog, setShowMenuDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  
  // Form states
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'staff' });
  const [tableForm, setTableForm] = useState({ table_number: '', capacity: '' });
  const [menuForm, setMenuForm] = useState({ name: '', category: '', price: '', description: '' });
  const [settingsForm, setSettingsForm] = useState({ 
    currency_symbol: '$', 
    currency_code: 'USD',
    tax_enabled: false,
    tax_rate: 0,
    tax_name: 'Tax'
  });
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchTables();
    fetchMenu();
    setSettingsForm({ 
      currency_symbol: currencySymbol, 
      currency_code: currencyCode,
      tax_enabled: taxEnabled,
      tax_rate: taxRate,
      tax_name: taxName
    });
  }, [currencySymbol, currencyCode, taxEnabled, taxRate, taxName]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`, { headers: getAuthHeader() });
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    }
  };

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

  // User Management
  const createUser = async () => {
    if (!userForm.username || !userForm.password) {
      toast.error('Please fill all fields');
      return;
    }
    
    try {
      await axios.post(`${API}/auth/register`, userForm, { headers: getAuthHeader() });
      toast.success('User created successfully');
      setUserForm({ username: '', password: '', role: 'staff' });
      setShowUserDialog(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await axios.delete(`${API}/users/${userId}`, { headers: getAuthHeader() });
      toast.success('User deleted');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  // Table Management
  const saveTable = async () => {
    if (!tableForm.table_number || !tableForm.capacity) {
      toast.error('Please fill all fields');
      return;
    }
    
    try {
      if (editingItem) {
        await axios.put(`${API}/tables/${editingItem.id}`, {
          table_number: tableForm.table_number,
          capacity: parseInt(tableForm.capacity)
        }, { headers: getAuthHeader() });
        toast.success('Table updated');
      } else {
        await axios.post(`${API}/tables`, {
          table_number: tableForm.table_number,
          capacity: parseInt(tableForm.capacity)
        }, { headers: getAuthHeader() });
        toast.success('Table created');
      }
      
      setTableForm({ table_number: '', capacity: '' });
      setEditingItem(null);
      setShowTableDialog(false);
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save table');
    }
  };

  const editTable = (table) => {
    setEditingItem(table);
    setTableForm({ table_number: table.table_number, capacity: table.capacity.toString() });
    setShowTableDialog(true);
  };

  const deleteTable = async (tableId) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    
    try {
      await axios.delete(`${API}/tables/${tableId}`, { headers: getAuthHeader() });
      toast.success('Table deleted');
      fetchTables();
    } catch (error) {
      toast.error('Failed to delete table');
    }
  };

  // Menu Management
  const saveMenuItem = async () => {
    if (!menuForm.name || !menuForm.category || !menuForm.price) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      const data = {
        name: menuForm.name,
        category: menuForm.category,
        price: parseFloat(menuForm.price),
        description: menuForm.description || null
      };
      
      if (editingItem) {
        await axios.put(`${API}/menu/${editingItem.id}`, data, { headers: getAuthHeader() });
        toast.success('Menu item updated');
      } else {
        await axios.post(`${API}/menu`, data, { headers: getAuthHeader() });
        toast.success('Menu item created');
      }
      
      setMenuForm({ name: '', category: '', price: '', description: '' });
      setEditingItem(null);
      setShowMenuDialog(false);
      fetchMenu();
    } catch (error) {
      toast.error('Failed to save menu item');
    }
  };

  const editMenuItem = (item) => {
    setEditingItem(item);
    setMenuForm({
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      description: item.description || ''
    });
    setShowMenuDialog(true);
  };

  const deleteMenuItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    try {
      await axios.delete(`${API}/menu/${itemId}`, { headers: getAuthHeader() });
      toast.success('Menu item deleted');
      fetchMenu();
    } catch (error) {
      toast.error('Failed to delete menu item');
    }
  };

  const saveSettings = async () => {
    // Update currency
    const currencyResult = await updateCurrency(settingsForm.currency_symbol, settingsForm.currency_code);
    // Update tax
    const taxResult = await updateTaxSettings(settingsForm.tax_enabled, settingsForm.tax_rate, settingsForm.tax_name);
    
    if (currencyResult.success && taxResult.success) {
      toast.success('Settings updated successfully');
      setShowSettingsDialog(false);
    } else {
      toast.error(currencyResult.error || taxResult.error || 'Failed to update settings');
    }
  };

  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="admin-panel">
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
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>Admin Panel</h1>
          </div>
          <Button
            variant="outline"
            onClick={logout}
            className="rounded-full border-slate-200"
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <div></div>
          <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-full border-slate-200" data-testid="settings-button">
                <DollarSign className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="settings-dialog" className="max-w-md">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Currency</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Symbol</Label>
                      <Input
                        value={settingsForm.currency_symbol}
                        onChange={(e) => setSettingsForm({ ...settingsForm, currency_symbol: e.target.value })}
                        placeholder="$"
                        data-testid="currency-symbol-input"
                      />
                    </div>
                    <div>
                      <Label>Code</Label>
                      <Input
                        value={settingsForm.currency_code}
                        onChange={(e) => setSettingsForm({ ...settingsForm, currency_code: e.target.value })}
                        placeholder="USD"
                        data-testid="currency-code-input"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Tax Settings</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsForm.tax_enabled}
                        onChange={(e) => setSettingsForm({ ...settingsForm, tax_enabled: e.target.checked })}
                        className="w-4 h-4"
                        data-testid="tax-enabled-checkbox"
                      />
                      <span className="text-sm">Enable Tax</span>
                    </label>
                  </div>
                  
                  {settingsForm.tax_enabled && (
                    <div className="space-y-3">
                      <div>
                        <Label>Tax Name</Label>
                        <Input
                          value={settingsForm.tax_name}
                          onChange={(e) => setSettingsForm({ ...settingsForm, tax_name: e.target.value })}
                          placeholder="e.g., GST, VAT, Sales Tax"
                          data-testid="tax-name-input"
                        />
                      </div>
                      <div>
                        <Label>Tax Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={settingsForm.tax_rate}
                          onChange={(e) => setSettingsForm({ ...settingsForm, tax_rate: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          data-testid="tax-rate-input"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <Button
                  onClick={saveSettings}
                  className="w-full bg-[#C9A961] hover:bg-[#B8945F] text-white rounded-full"
                  data-testid="save-settings-button"
                >
                  Save Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="menu" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="menu" data-testid="menu-tab">
              <UtensilsCrossed className="w-4 h-4 mr-2" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="tables" data-testid="tables-tab">
              <TableIcon className="w-4 h-4 mr-2" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="users-tab">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
          </TabsList>

          {/* Menu Tab */}
          <TabsContent value="menu" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>Menu Items</h2>
              <Dialog open={showMenuDialog} onOpenChange={(open) => {
                setShowMenuDialog(open);
                if (!open) {
                  setEditingItem(null);
                  setMenuForm({ name: '', category: '', price: '', description: '' });
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-[#C9A961] hover:bg-[#B8945F] text-white rounded-full" data-testid="add-menu-item-button">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Menu Item
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="menu-dialog">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? 'Edit' : 'Add'} Menu Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Item Name</Label>
                      <Input
                        value={menuForm.name}
                        onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                        placeholder="e.g., Butter Chicken"
                        data-testid="menu-name-input"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input
                        value={menuForm.category}
                        onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                        placeholder="e.g., Main Course"
                        data-testid="menu-category-input"
                      />
                    </div>
                    <div>
                      <Label>Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={menuForm.price}
                        onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                        placeholder="0.00"
                        data-testid="menu-price-input"
                      />
                    </div>
                    <div>
                      <Label>Description (Optional)</Label>
                      <Input
                        value={menuForm.description}
                        onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                        placeholder="Brief description"
                        data-testid="menu-description-input"
                      />
                    </div>
                    <Button
                      onClick={saveMenuItem}
                      className="w-full bg-[#C9A961] hover:bg-[#B8945F] text-white rounded-full"
                      data-testid="save-menu-item-button"
                    >
                      {editingItem ? 'Update' : 'Create'} Item
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-6">
              {Object.entries(groupedMenuItems).map(([category, items]) => (
                <Card key={category} className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg" style={{ fontFamily: 'DM Sans, sans-serif' }}>{category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg" data-testid={`menu-item-${item.id}`}>
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            {item.description && (
                              <div className="text-sm text-slate-500">{item.description}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="font-bold mono">{formatPrice(item.price)}</div>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => editMenuItem(item)}
                              className="rounded-full h-8 w-8"
                              data-testid={`edit-menu-item-${item.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => deleteMenuItem(item.id)}
                              className="rounded-full h-8 w-8"
                              data-testid={`delete-menu-item-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {Object.keys(groupedMenuItems).length === 0 && (
                <Card className="p-12 text-center border-slate-200">
                  <div className="text-slate-400">No menu items yet</div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Tables Tab */}
          <TabsContent value="tables" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>Restaurant Tables</h2>
              <Dialog open={showTableDialog} onOpenChange={(open) => {
                setShowTableDialog(open);
                if (!open) {
                  setEditingItem(null);
                  setTableForm({ table_number: '', capacity: '' });
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-[#C9A961] hover:bg-[#B8945F] text-white rounded-full" data-testid="add-table-button">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Table
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="table-dialog">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? 'Edit' : 'Add'} Table</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Table Number</Label>
                      <Input
                        value={tableForm.table_number}
                        onChange={(e) => setTableForm({ ...tableForm, table_number: e.target.value })}
                        placeholder="e.g., T1, A5"
                        data-testid="table-number-input"
                      />
                    </div>
                    <div>
                      <Label>Capacity</Label>
                      <Input
                        type="number"
                        value={tableForm.capacity}
                        onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })}
                        placeholder="Number of seats"
                        data-testid="table-capacity-input"
                      />
                    </div>
                    <Button
                      onClick={saveTable}
                      className="w-full bg-[#C9A961] hover:bg-[#B8945F] text-white rounded-full"
                      data-testid="save-table-button"
                    >
                      {editingItem ? 'Update' : 'Create'} Table
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((table) => (
                <Card key={table.id} className="border-slate-200" data-testid={`table-item-${table.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>{table.table_number}</div>
                        <div className="text-sm text-slate-500">Capacity: {table.capacity}</div>
                        <div className="text-sm text-slate-500 capitalize">Status: {table.status}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => editTable(table)}
                          className="rounded-full h-8 w-8"
                          data-testid={`edit-table-${table.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => deleteTable(table.id)}
                          className="rounded-full h-8 w-8"
                          disabled={table.status === 'running'}
                          data-testid={`delete-table-${table.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {tables.length === 0 && (
              <Card className="p-12 text-center border-slate-200">
                <div className="text-slate-400">No tables configured</div>
              </Card>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif' }}>Staff Users</h2>
              <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-[#C9A961] hover:bg-[#B8945F] text-white rounded-full" data-testid="add-user-button">
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="user-dialog">
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={userForm.username}
                        onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                        placeholder="Enter username"
                        data-testid="user-username-input"
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        placeholder="Enter password"
                        data-testid="user-password-input"
                      />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select value={userForm.role} onValueChange={(value) => setUserForm({ ...userForm, role: value })}>
                        <SelectTrigger data-testid="user-role-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={createUser}
                      className="w-full bg-[#C9A961] hover:bg-[#B8945F] text-white rounded-full"
                      data-testid="create-user-button"
                    >
                      Create User
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-slate-200">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-200">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4" data-testid={`user-item-${user.id}`}>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-sm text-slate-500 capitalize">{user.role}</div>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteUser(user.id)}
                        className="rounded-full h-8 w-8"
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {users.length === 0 && (
              <Card className="p-12 text-center border-slate-200">
                <div className="text-slate-400">No users found</div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
