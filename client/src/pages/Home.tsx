import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, Zap, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { getLoginUrl } from "@/const";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect to dashboard
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Navigation */}
      <nav className="border-b border-border/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">SmartStock AI</span>
          </div>
          <Button asChild>
            <a href={getLoginUrl()}>Sign In</a>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-6 leading-tight">
          Intelligent Inventory<br />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Management System
          </span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
          Identify and clear slow-moving stock with AI-powered insights. Make data-driven decisions to minimize losses and optimize inventory.
        </p>
        <Button asChild size="lg" className="gap-2">
          <a href={getLoginUrl()}>
            Get Started Free
          </a>
        </Button>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-foreground text-center mb-12">Powerful Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<BarChart3 className="w-8 h-8" />}
            title="Real-Time Dashboard"
            description="Monitor inventory levels, sales velocity, and days unsold at a glance with beautiful visualizations."
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="AI Predictions"
            description="Predict demand patterns and identify dead stock before it becomes a problem using machine learning."
          />
          <FeatureCard
            icon={<Shield className="w-8 h-8" />}
            title="Smart Recommendations"
            description="Get actionable suggestions for discounts, bundling, and redistribution to move inventory faster."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="bg-card rounded-lg border border-border p-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to optimize your inventory?</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Start managing your inventory intelligently today.
          </p>
          <Button asChild size="lg">
            <a href={getLoginUrl()}>Sign In with Manus</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-20 py-8 text-center text-muted-foreground">
        <p>&copy; 2026 SmartStock AI. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card-elevated p-8 text-center hover:shadow-lg transition-smooth">
      <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 text-primary">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
