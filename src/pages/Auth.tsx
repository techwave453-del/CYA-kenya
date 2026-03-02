import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, WifiOff, Home } from "lucide-react";
import { z } from "zod";
import { getAuthSession } from "@/lib/offlineDb";
import { Link } from "react-router-dom";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  username: z.string().min(2, "Username must be at least 2 characters").optional(),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasOfflineSession, setHasOfflineSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const checkOfflineSession = async () => {
      const session = await getAuthSession();
      if (session && session.expires_at * 1000 > Date.now()) {
        setHasOfflineSession(true);
      }
    };
    
    if (!isOnline) {
      checkOfflineSession();
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          navigate("/");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isOnline]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validationData = isLogin 
        ? { email, password } 
        : { email, password, username };
      
      const result = authSchema.safeParse(validationData);
      if (!result.success) {
        toast({
          title: "Validation Error",
          description: result.error.errors[0].message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast({
            title: "Login Failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "You have successfully logged in.",
          });
        }
      } else {
        const redirectUrl = `${window.location.origin}/`;
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              username: username || email.split("@")[0],
            },
          },
        });

        if (error) {
          toast({
            title: "Signup Failed",
            description: error.message,
            variant: "destructive",
          });
        } else if (data.user) {
          toast({
            title: "Account Created!",
            description: "Welcome to CYA Kenya!",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Offline view with cached session
  if (!isOnline && hasOfflineSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-primary text-4xl font-bold">✚</span>
            <span className="font-heading text-3xl font-bold text-foreground">CYA</span>
          </div>
          
          <div className="bg-secondary rounded-lg p-6 space-y-4">
            <WifiOff className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="font-heading text-xl font-bold text-foreground">You're Offline</h2>
            <p className="text-muted-foreground">
              You have a cached session. You can continue using the app in offline mode.
            </p>
            <Link to="/">
              <Button className="w-full bg-primary text-primary-foreground">
                <Home className="w-4 h-4 mr-2" />
                Continue to App
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Offline view without session
  if (!isOnline) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-primary text-4xl font-bold">✚</span>
            <span className="font-heading text-3xl font-bold text-foreground">CYA</span>
          </div>
          
          <div className="bg-secondary rounded-lg p-6 space-y-4">
            <WifiOff className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="font-heading text-xl font-bold text-foreground">You're Offline</h2>
            <p className="text-muted-foreground">
              Please connect to the internet to sign in or create an account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-primary text-4xl font-bold">✚</span>
            <span className="font-heading text-3xl font-bold text-foreground">CYA</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {isLogin ? "Welcome Back" : "Join CYA Kenya"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isLogin
              ? "Sign in to connect with the community"
              : "Create an account to share your faith"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="bg-card border-border text-foreground"
                required={!isLogin}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="bg-card border-border text-foreground"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="bg-card border-border text-foreground pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isLogin ? "Signing in..." : "Creating account..."}
              </>
            ) : (
              <>{isLogin ? "Sign In" : "Create Account"}</>
            )}
          </Button>
        </form>

        {/* Toggle */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
