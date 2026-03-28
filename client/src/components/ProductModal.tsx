import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { X } from "lucide-react";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProductModal({ isOpen, onClose, onSuccess }: ProductModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    sku: "",
    description: "",
    currentStock: 0,
    reorderPoint: 10,
    basePrice: 0,
    expiryDate: "",
  });

  const createProduct = trpc.products.create.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createProduct.mutateAsync({
        name: formData.name,
        category: formData.category || undefined,
        sku: formData.sku || undefined,
        description: formData.description || undefined,
        currentStock: formData.currentStock,
        reorderPoint: formData.reorderPoint,
        basePrice: formData.basePrice,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined,
      });

      setFormData({
        name: "",
        category: "",
        sku: "",
        description: "",
        currentStock: 0,
        reorderPoint: 10,
        basePrice: 0,
        expiryDate: "",
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to create product:", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "currentStock" || name === "reorderPoint" || name === "basePrice" 
        ? parseFloat(value) || 0 
        : value,
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium">Product Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter product name"
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category" className="text-sm font-medium">Category</Label>
              <Input
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="e.g., Electronics"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="sku" className="text-sm font-medium">SKU</Label>
              <Input
                id="sku"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="e.g., SKU-001"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Product description"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-input text-foreground placeholder:text-muted transition-smooth focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="currentStock" className="text-sm font-medium">Current Stock *</Label>
              <Input
                id="currentStock"
                name="currentStock"
                type="number"
                value={formData.currentStock}
                onChange={handleChange}
                placeholder="0"
                min="0"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="reorderPoint" className="text-sm font-medium">Reorder Point</Label>
              <Input
                id="reorderPoint"
                name="reorderPoint"
                type="number"
                value={formData.reorderPoint}
                onChange={handleChange}
                placeholder="10"
                min="0"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="basePrice" className="text-sm font-medium">Base Price *</Label>
              <Input
                id="basePrice"
                name="basePrice"
                type="number"
                value={formData.basePrice}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="expiryDate" className="text-sm font-medium">Expiry Date</Label>
              <Input
                id="expiryDate"
                name="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={handleChange}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProduct.isPending}
              className="flex-1"
            >
              {createProduct.isPending ? "Creating..." : "Add Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
