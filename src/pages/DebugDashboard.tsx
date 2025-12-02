import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DebugDashboard = () => {
  const [debug, setDebug] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get brand
      const { data: brand } = await (supabase as any)
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!brand) {
        setDebug({ error: "No brand found for this user" });
        return;
      }

      // Get brand products
      const { data: products } = await (supabase as any)
        .from("brand_products")
        .select("*")
        .eq("brand_id", brand.id);

      // Get ALL wishlist items (to see what's in the database)
      const { data: allItems, error: itemsError } = await (supabase as any)
        .from("wishlist_items")
        .select("id, title, brand, brand_product_id, wishlist_id")
        .limit(20);

      setDebug({
        brandId: brand.id,
        products,
        allItems,
        itemsError: itemsError?.message || null,
        columnExists: allItems && allItems.length > 0 && 'brand_product_id' in allItems[0],
      });
    })();
  }, []);

  if (!debug) return <div className="p-8">Loading debug info...</div>;

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Dashboard Debug Info</h1>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="font-bold mb-2">Brand ID:</h2>
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
          {JSON.stringify(debug.brandId, null, 2)}
        </pre>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="font-bold mb-2">Your Brand Products:</h2>
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
          {JSON.stringify(debug.products, null, 2)}
        </pre>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="font-bold mb-2">Recent Wishlist Items (checking brand_product_id):</h2>
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
          {JSON.stringify(debug.allItems, null, 2)}
        </pre>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="font-bold mb-2">Column Exists Check:</h2>
        <p className="text-sm">
          {debug.columnExists ? "✅ brand_product_id column EXISTS" : "❌ brand_product_id column MISSING - Run migration!"}
        </p>
      </div>

      {debug.error && (
        <div className="bg-red-100 p-4 rounded-lg">
          <p className="text-red-800">{debug.error}</p>
        </div>
      )}
    </div>
  );
};

export default DebugDashboard;
