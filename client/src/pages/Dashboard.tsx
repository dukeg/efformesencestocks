import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BarChart3, Package, AlertCircle, TrendingDown, Settings, LogOut } from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "alerts" | "recommendations">("overview");
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card shadow-sm">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">SmartStock</h1>
              <p className="text-xs text-muted-foreground">AI Inventory</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          <NavItem
            icon={<BarChart3 className="w-5 h-5" />}
            label="Overview"
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
          />
          <NavItem
            icon={<Package className="w-5 h-5" />}
            label="Products"
            active={activeTab === "products"}
            onClick={() => setActiveTab("products")}
          />
          <NavItem
            icon={<AlertCircle className="w-5 h-5" />}
            label="Alerts"
            active={activeTab === "alerts"}
            onClick={() => setActiveTab("alerts")}
          />
          <NavItem
            icon={<TrendingDown className="w-5 h-5" />}
            label="Recommendations"
            active={activeTab === "recommendations"}
            onClick={() => setActiveTab("recommendations")}
          />
        </nav>

        <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/10">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "products" && <ProductsTab />}
          {activeTab === "alerts" && <AlertsTab />}
          {activeTab === "recommendations" && <RecommendationsTab />}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-smooth ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-muted/10"
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function OverviewTab() {
  const { data: overview, isLoading } = trpc.analytics.overview.useQuery();
  const { data: healthDist } = trpc.analytics.healthDistribution.useQuery();

  if (isLoading) {
    return <div className="text-center py-12">Loading overview...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard Overview</h2>
        <p className="text-muted-foreground">Real-time inventory insights and analytics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Products"
          value={overview?.totalProducts || 0}
          icon={<Package className="w-5 h-5" />}
          color="blue"
        />
        <KPICard
          title="Total Stock"
          value={overview?.totalStock || 0}
          icon={<BarChart3 className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          title="Inventory Value"
          value={`$${(overview?.totalValue || 0).toLocaleString()}`}
          icon={<TrendingDown className="w-5 h-5" />}
          color="purple"
        />
        <KPICard
          title="Dead Stock Items"
          value={overview?.deadStockCount || 0}
          icon={<AlertCircle className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* Health Distribution */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold text-foreground mb-4">Inventory Health Distribution</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{healthDist?.healthy || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">Healthy</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600">{healthDist?.warning || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">Warning</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{healthDist?.critical || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">Critical</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ProductsTab() {
  const { data: products, isLoading } = trpc.products.list.useQuery();

  if (isLoading) {
    return <div className="text-center py-12">Loading products...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Products</h2>
          <p className="text-muted-foreground mt-1">Manage your inventory items</p>
        </div>
        <Button className="gap-2">
          <Package className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/5">
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Category</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Stock</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Days Unsold</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Price</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {products?.map((product) => (
                <tr key={product.id} className="border-b border-border/50 hover:bg-muted/5 transition-smooth">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{product.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{product.category || "-"}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{product.currentStock}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{product.daysUnsold || 0}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground">${parseFloat(product.currentPrice).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm">
                    <StatusBadge daysUnsold={product.daysUnsold || 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AlertsTab() {
  const { data: alerts, isLoading } = trpc.alerts.list.useQuery({ unreadOnly: false });

  if (isLoading) {
    return <div className="text-center py-12">Loading alerts...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Alerts</h2>
        <p className="text-muted-foreground mt-1">High-risk products requiring attention</p>
      </div>

      <div className="space-y-3">
        {alerts?.map((alert) => (
          <Card key={alert.id} className="p-4 border-l-4" style={{
            borderLeftColor: alert.severity === "critical" ? "#ef4444" : alert.severity === "high" ? "#f97316" : "#eab308"
          }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-foreground">{alert.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(alert.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                alert.severity === "critical" ? "status-critical" :
                alert.severity === "high" ? "status-warning" :
                "status-healthy"
              }`}>
                {alert.severity.toUpperCase()}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RecommendationsTab() {
  const { data: recommendations, isLoading } = trpc.recommendations.list.useQuery({ actionedOnly: false });

  if (isLoading) {
    return <div className="text-center py-12">Loading recommendations...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">AI Recommendations</h2>
        <p className="text-muted-foreground mt-1">Smart suggestions to optimize inventory</p>
      </div>

      <div className="space-y-3">
        {recommendations?.map((rec) => (
          <Card key={rec.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                    {rec.recommendationType.toUpperCase()}
                  </span>
                  {rec.discountPercentage && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-accent/10 text-accent">
                      {rec.discountPercentage}% OFF
                    </span>
                  )}
                </div>
                <p className="font-medium text-foreground">{rec.suggestedAction}</p>
                {rec.estimatedImpact && (
                  <p className="text-sm text-muted-foreground mt-1">Impact: {rec.estimatedImpact}</p>
                )}
              </div>
              {!rec.isActioned && (
                <Button size="sm" className="ml-4">Apply</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "red";
}) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
    red: "bg-red-100 text-red-600",
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ daysUnsold }: { daysUnsold: number }) {
  if (daysUnsold > 60) {
    return <span className="status-critical">Critical</span>;
  } else if (daysUnsold > 30) {
    return <span className="status-warning">Warning</span>;
  } else if (daysUnsold > 7) {
    return <span className="status-warning">Slow-Moving</span>;
  } else {
    return <span className="status-healthy">Healthy</span>;
  }
}
