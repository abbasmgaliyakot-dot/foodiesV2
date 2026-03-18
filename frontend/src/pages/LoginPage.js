import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { UtensilsCrossed } from 'lucide-react';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await login(username, password);
    
    if (result.success) {
      toast.success('Login successful!');
      navigate('/');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #FFF8ED 0%, #F8F9FA 50%, #E8F0EF 100%)' }}>
      {/* Decorative background elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[#C9A961] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-[#2C5F5D] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>
      
      <Card className="w-full max-w-md border-slate-200 shadow-2xl backdrop-blur-sm bg-white/90 relative z-10">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#C9A961] to-[#B8945F] rounded-full blur-lg opacity-50"></div>
              <img 
                src="https://customer-assets.emergentagent.com/job_dine-orders-1/artifacts/wkjm3b6v_IMG_6175.jpeg" 
                alt="Foodies Junction Logo" 
                className="w-32 h-32 object-contain relative z-10 drop-shadow-xl"
              />
            </div>
          </div>
          <div>
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-[#2C5F5D] to-[#1F4644] bg-clip-text text-transparent" style={{ fontFamily: 'DM Sans, sans-serif' }}>Foodies Junction</CardTitle>
            <CardDescription className="text-slate-600 mt-3 text-base">Welcome back! Sign in to manage your restaurant</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-700 font-medium">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="border-slate-200 focus:border-[#C9A961] focus:ring-[#C9A961] h-12 shadow-sm transition-all"
                data-testid="username-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-200 focus:border-[#C9A961] focus:ring-[#C9A961] h-12 shadow-sm transition-all"
                data-testid="password-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#C9A961] to-[#B8945F] hover:from-[#B8945F] hover:to-[#A67D4B] text-white rounded-full font-medium h-12 shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
              data-testid="login-button"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
