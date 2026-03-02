import { useState, useEffect } from "react";
import { Download, Smartphone, Share, Plus, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border">
          <CardHeader className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-foreground">App Installed!</CardTitle>
            <CardDescription>
              CYA Kenya is now installed on your device. You can access it from your home screen.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-card border-border">
        <CardHeader className="text-center">
          <Smartphone className="w-16 h-16 text-primary mx-auto mb-4" />
          <CardTitle className="text-foreground">Install CYA Kenya</CardTitle>
          <CardDescription>
            Install our app for the best experience. Access it directly from your home screen!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deferredPrompt && (
            <Button onClick={handleInstallClick} className="w-full" size="lg">
              <Download className="w-5 h-5 mr-2" />
              Install App
            </Button>
          )}

          {isIOS && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">To install on iPhone/iPad:</p>
              <div className="flex items-start gap-3">
                <Share className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
                <p>Tap the Share button in Safari's toolbar</p>
              </div>
              <div className="flex items-start gap-3">
                <Plus className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
                <p>Scroll down and tap "Add to Home Screen"</p>
              </div>
            </div>
          )}

          {!deferredPrompt && !isIOS && (
            <div className="text-sm text-muted-foreground text-center">
              <p>Open this page in Chrome, Edge, or Safari to install the app.</p>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <h3 className="font-medium text-foreground mb-2">Benefits of installing:</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Quick access from your home screen</li>
              <li>• Works offline</li>
              <li>• Faster loading times</li>
              <li>• Native app-like experience</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
